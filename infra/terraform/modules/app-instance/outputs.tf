output "instance_id" {
  description = "ID of the app instance. Use it with: aws ssm start-session --target <id>"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "Public IPv4 of the app instance. Needed for outbound traffic, not for inbound: nothing listens."
  value       = aws_instance.app.public_ip
}