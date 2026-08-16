output "instance_id" {
  description = "ID of the app instance."
  value       = module.app_instance.instance_id
}

output "public_ip" {
  description = "Public IPv4 of the app instance."
  value       = module.app_instance.public_ip
}

output "ssm_command" {
  description = "Ready-to-paste command to open a shell on the instance."
  value       = "aws ssm start-session --target ${module.app_instance.instance_id} --region ${var.region}"
}

output "github_actions_role_arn" {
  description = "ARN of the role that GitHub Actions assumes via OIDC for deployment (SSM only)."
  value       = aws_iam_role.github_actions_deploy.arn
}

output "github_actions_build_role_arn" {
  description = "ARN of the role that GitHub Actions assumes via OIDC for image builds (ECR push only)."
  value       = aws_iam_role.github_actions_build.arn
}

output "ecr_repository_urls" {
  description = "ECR repository URLs, keyed by app name."
  value       = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}