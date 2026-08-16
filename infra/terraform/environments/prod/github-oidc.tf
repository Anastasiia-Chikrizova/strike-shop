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
  # differs. repository_id/repository_owner_id pin the repo as a second,
  # independent factor alongside sub — GitHub doesn't put them in sub itself.
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
            "repo:Anastasiia-Chikrizova/strike-shop:ref:refs/heads/main",
            "repo:Anastasiia-Chikrizova/strike-shop:environment:prod",
            "repo:Anastasiia-Chikrizova/strike-shop:environment:eks",
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
      }
    ]
  })
}