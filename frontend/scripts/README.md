# Cognito User Management Scripts

Scripts để quản lý users trong AWS Cognito User Pool.

## Yêu cầu

1. **AWS CLI đã cài đặt**
   ```powershell
   # Kiểm tra AWS CLI
   aws --version
   
   # Nếu chưa có, tải tại: https://aws.amazon.com/cli/
   ```

2. **AWS Credentials đã được cấu hình**
   ```powershell
   # Cấu hình AWS credentials
   aws configure
   
   # Nhập:
   # - AWS Access Key ID
   # - AWS Secret Access Key
   # - Default region: us-east-1
   # - Output format: json
   ```

## Các Scripts

### 1. List Users (Xem danh sách users)

```powershell
cd frontend/scripts
.\list-cognito-users.ps1
```

Hiển thị tất cả users trong User Pool với:
- Email
- Name
- Status (CONFIRMED/UNCONFIRMED)
- Enabled status

### 2. Delete User (Xóa user)

```powershell
cd frontend/scripts
.\delete-cognito-user.ps1 -Email "test@example.com"
```

Xóa user khỏi Cognito để có thể đăng ký lại với email đó.

## Ví dụ sử dụng

```powershell
# 1. Xem tất cả users hiện có
.\list-cognito-users.ps1

# 2. Xóa user cụ thể
.\delete-cognito-user.ps1 -Email "test@gmail.com"

# 3. Verify user đã bị xóa
.\list-cognito-users.ps1
```

## User Status trong Cognito

- **UNCONFIRMED**: User đã đăng ký nhưng chưa xác thực email
- **CONFIRMED**: User đã xác thực email, có thể login
- **ARCHIVED**: User bị vô hiệu hóa
- **COMPROMISED**: User bị đánh dấu có vấn đề bảo mật
- **UNKNOWN**: Không xác định
- **RESET_REQUIRED**: Cần reset password
- **FORCE_CHANGE_PASSWORD**: Bắt buộc đổi password

## Troubleshooting

### Lỗi: "Unable to locate credentials"
```powershell
aws configure
# Nhập lại AWS credentials
```

### Lỗi: "An error occurred (UserNotFoundException)"
- User không tồn tại trong Cognito
- Kiểm tra lại email chính xác

### Lỗi: "AccessDeniedException"
- AWS IAM user không có quyền
- Cần permissions: `cognito-idp:AdminDeleteUser`, `cognito-idp:ListUsers`

## User Pool Info

- **User Pool ID**: `us-east-1_ra3KwfSmc`
- **Region**: `us-east-1`
- **Client ID**: `50me6jgm9b89dvl1vlu1dmgf4i`
