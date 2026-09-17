# Deploy the signup and PDF-processing fixes

Your deployment uses Vercel for the frontend, ECR/ECS Fargate for the backend,
private RDS, and S3 in `ca-central-1`. Pushing to GitHub updates the connected
Vercel project; it does not update the backend in ECS.

## 1. Build and publish the backend

Start Docker Desktop and open PowerShell in the `contextly` repository.
Use the commit SHA as an immutable image tag so migration and service use the
same code:

```powershell
$region = "ca-central-1"
$account = aws sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) { throw "Sign in to AWS before continuing." }
$registry = "$account.dkr.ecr.$region.amazonaws.com"
$tag = git rev-parse --short HEAD
$image = "${registry}/contextly-backend:$tag"

docker build --platform linux/amd64 -t $image ./backend
if ($LASTEXITCODE -ne 0) { throw "Backend build failed." }
aws ecr get-login-password --region $region | docker login --username AWS --password-stdin $registry
if ($LASTEXITCODE -ne 0) { throw "ECR login failed." }
docker push $image
if ($LASTEXITCODE -ne 0) { throw "Image push failed." }
Write-Output $image
```

If ECR authentication expires, repeat the login command. These fixes do not
require changing your Clerk or OpenAI credentials.

## 2. Create a task-definition revision

ECS → Task definitions → `contextly-backend-task` → Create new revision.
For container `contextly-backend`, set the image URI printed in step 1.
Preserve task/execution roles, secret references, port 8000, logging, and
environment settings, including:

```text
FRONTEND_URL=https://contextly.osazeeero.com
STORAGE_BACKEND=s3
AWS_REGION=ca-central-1
```

Save the revision. Do not update the service yet.

## 3. Run the migration from ECS

The backend needs a nullable `documents.error_message` column. The migration
preserves existing documents and is compatible with the old backend. Older
failed uploads receive a generic message: their original cause was never stored.

ECS → `contextly-cluster` → Tasks → Run new task:

- Use Fargate and the **new revision** from step 2.
- Match the current service's VPC, subnets, security group and public-IP setting.
  RDS is private; do not try running this migration against RDS from your laptop.
- Under container overrides for `contextly-backend`, set the command to
  `alembic,upgrade,head` (command array: `["alembic", "upgrade", "head"]`).
- Run **one** task. Wait for it to stop and verify **container exit code 0**.
  CloudWatch logs should show revision `a82e31c49f10`.

If it fails, leave the service on its existing revision and inspect the logs.
Do not deploy the new backend until the migration succeeds.

Account linking is now based on Clerk identity, not a matching email address.
A legacy local-development account with no Clerk ID is deliberately not auto-linked;
it requires an explicit, verified migration if you need to retain that data.

## 4. Update the backend service

ECS → `contextly-cluster` → `contextly-backend-service` → Update.
Select the new revision and **Force new deployment**. Wait for deployment to
complete and the load-balancer target to become healthy. Confirm
`https://api.osazeeero.com/api/health` responds successfully.

## 5. Check the frontend deployment

Push the frontend commit to the branch connected to the Contextly Vercel project.
If already pushed, check Vercel's deployment status and redeploy that commit if
necessary. The frontend tolerates an older backend during rollout, but detailed
PDF errors and retry require the new backend.

At `https://contextly.osazeeero.com`, check:

1. A fresh account loads its dashboard without manual refresh.
2. A PDF with selectable text reaches Ready and supports cited answers.
3. A scanned PDF shows an explanation when processing fails.
4. Retry processing reuses the saved file and reaches Ready or explains why it failed.
5. Another account cannot access the first account's documents.

For rollback, select the previous ECS revision. Keep the nullable database
column; a schema downgrade is unnecessary. Vercel can also promote its previous
deployment if needed.

## Local verification

The integration tests use mocked Clerk/OpenAI and a disposable pgvector database,
never RDS. They explicitly connect only to `contextly_test` at
`127.0.0.1:55439` and clear its test data.

```powershell
docker run --detach --name contextly-review-db --publish 127.0.0.1:55439:5432 --env POSTGRES_USER=contextly_test --env POSTGRES_PASSWORD=contextly_test --env POSTGRES_DB=contextly_test pgvector/pgvector:pg16
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd ../frontend
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm.cmd run test:e2e
```

If the named container already exists, start it instead of creating another.
After testing, `docker stop contextly-review-db` stops only this test database.

PDF ingestion still uses FastAPI background tasks. A durable worker queue is
needed to guarantee recovery when ECS stops during processing. These tests do
not simulate production task termination or real provider outages; this release
does not claim to eliminate every possible production issue.

References: [ECS service updates](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/update-service-console-v2.html),
[task command overrides](https://docs.aws.amazon.com/cli/latest/reference/ecs/run-task.html).
