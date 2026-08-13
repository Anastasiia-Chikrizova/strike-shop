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