# CI/CD Workflows

GitHub Actions workflows for Smart Cooking project.

## Workflows

### 1. CI Pipeline (ci.yml)
**Trigger**: Push/PR to main or develop branches

**Jobs**:
- **Test**: Run unit tests (Express + Lambda)
- **Lint**: Code quality checks

**Status**: ✅ Configured

### 2. CD Pipeline (cd.yml)
**Trigger**: 
- Push to main branch
- Manual workflow dispatch

**Jobs**:
- Deploy CDK stacks
- Run smoke tests

**Environments**:
- dev (default)
- prod (manual trigger)

**Required Secrets**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**Status**: ✅ Configured

### 3. Security Scan (security.yml)
**Trigger**: 
- Weekly (Sunday 00:00 UTC)
- Manual workflow dispatch

**Jobs**:
- **Security Tests**: Run authentication security tests
- **Dependency Scan**: npm audit for vulnerabilities

**Status**: ✅ Configured

## Setup Instructions

### 1. Configure GitHub Secrets

Go to repository Settings → Secrets and variables → Actions

Add the following secrets:
```
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
```

### 2. Configure Environments

Go to repository Settings → Environments

Create environments:
- **dev**: Development environment
- **prod**: Production environment (add protection rules)

### 3. Enable Workflows

Workflows are automatically enabled when pushed to GitHub.

## Manual Deployment

### Deploy to Dev
1. Go to Actions tab
2. Select "CD Pipeline"
3. Click "Run workflow"
4. Select environment: `dev`
5. Click "Run workflow"

### Deploy to Prod
1. Go to Actions tab
2. Select "CD Pipeline"
3. Click "Run workflow"
4. Select environment: `prod`
5. Click "Run workflow"

## Workflow Status Badges

Add to README.md:

```markdown
![CI](https://github.com/YOUR_USERNAME/smart-cooking/workflows/CI%20Pipeline/badge.svg)
![CD](https://github.com/YOUR_USERNAME/smart-cooking/workflows/CD%20Pipeline/badge.svg)
![Security](https://github.com/YOUR_USERNAME/smart-cooking/workflows/Security%20Scan/badge.svg)
```

## Pipeline Flow

### CI Pipeline
```
Push/PR → Test → Lint → ✅
```

### CD Pipeline
```
Push to main → CDK Deploy → Smoke Test → ✅
```

### Security Pipeline
```
Weekly/Manual → Auth Tests → Dependency Scan → Report → ✅
```

## Troubleshooting

### CI Fails
- Check test logs in Actions tab
- Run tests locally: `npm test`
- Verify all dependencies installed

### CD Fails
- Verify AWS credentials configured
- Verify CDK bootstrap completed
- Check CloudFormation events

### Security Scan Fails
- Review security test output
- Check npm audit report
- Review Trivy scan results

## Best Practices

1. **Always test locally first**
   ```bash
   npm test
   ```

2. **Use feature branches**
   ```bash
   git checkout -b feature/my-feature
   ```

3. **Review PR checks before merge**
   - All tests passing
   - No security vulnerabilities
   - Code review approved

4. **Monitor deployments**
   - Check Actions tab for status
   - Review CloudWatch logs
   - Run smoke tests manually

## Notifications

Configure notifications in repository Settings → Notifications:
- Email on workflow failure
- Slack integration (optional)
- Discord webhook (optional)

## Metrics

Track CI/CD metrics:
- Build success rate
- Deployment frequency
- Mean time to recovery
- Test coverage

## Future Enhancements

- [ ] Add code coverage reporting
- [ ] Implement blue-green deployments
- [ ] Add performance testing
- [ ] Integrate with monitoring tools
- [ ] Add automatic rollback on failure
