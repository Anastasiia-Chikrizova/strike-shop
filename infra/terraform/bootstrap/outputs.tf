output "bucket_name" {
  description = "Name of the state bucket. Put this in the backend block of each root module."
  value       = aws_s3_bucket.tfstate.bucket
}