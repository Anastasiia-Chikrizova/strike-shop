data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [data.tls_certificate.github_actions.certificates[length(data.tls_certificate.github_actions.certificates) - 1].sha1_fingerprint]
}

data "aws_caller_identity" "current" {}

locals {
  # Same trust policy for both roles — only what each role's policy grants
  # differs. sub carries "@<id>" suffixes on purpose: this repo has a custom
  # sub_claim_prefix configured (Settings → Actions → General → OIDC
  # customization — confirmed via
  # `gh api repos/OWNER/REPO/actions/oidc/customization/sub`), so GitHub's
  # real tokens include them. repository_id/repository_owner_id are pinned
  # separately as a second, independent factor — those claims don't depend
  # on the sub customization.
  github_actions_assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud"                 = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:repository_id"       = "1311393187"
          "token.actions.githubusercontent.com:repository_owner_id" = "78729920"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [
            "repo:Anastasiia-Chikrizova@78729920/strike-shop@1311393187:ref:refs/heads/main",
            "repo:Anastasiia-Chikrizova@78729920/strike-shop@1311393187:environment:prod",
            "repo:Anastasiia-Chikrizova@78729920/strike-shop@1311393187:environment:eks",
          ]
        }
      }
    }]
  })
}

# Assumed by build-backend.yml / build-storefront.yml — ECR push only, see ecr.tf.
resource "aws_iam_role" "github_actions_build" {
  name               = "${var.project}-${var.environment}-github-build"
  assume_role_policy = local.github_actions_assume_role_policy
}

# Assumed by the deploy job in build-push.yml — SSM to the app instance only.
resource "aws_iam_role" "github_actions_deploy" {
  name               = "${var.project}-${var.environment}-github-deploy"
  assume_role_policy = local.github_actions_assume_role_policy
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "ssm-send-command"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SendCommand"
        Effect = "Allow"
        Action = "ssm:SendCommand"
        Resource = [
          "arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/${module.app_instance.instance_id}",
          "arn:aws:ssm:${var.region}::document/AWS-RunShellScript",
        ]
      },
      {
        Sid      = "ReadCommandResult"
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"]
        Resource = "*"
      },
      {
        # Resolves the current instance id by tag at deploy time instead of
        # hardcoding it in the workflow — DescribeInstances doesn't support
        # resource-level permissions, hence Resource = "*" (read-only).
        Sid      = "ResolveInstance"
        Effect   = "Allow"
        Action   = "ec2:DescribeInstances"
        Resource = "*"
      }
    ]
  })
}