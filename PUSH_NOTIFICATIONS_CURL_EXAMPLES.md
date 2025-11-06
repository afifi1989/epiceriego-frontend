# Push Notifications - cURL Examples (Ready to Copy/Paste)

## 🎯 Quick Reference

All cURL commands you need to test push notifications.

---

## 1️⃣ Get Authentication Token

```bash
curl -X POST "http://localhost:8090/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "password": "password123"
  }'
```

**Response**: Contains `token` field

Save the token:
```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

---

## 2️⃣ Register Device for Push Notifications

**This endpoint must be implemented on backend**

```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."
EXPO_TOKEN="ExponentPushToken[abc123...]"

curl -X POST "http://localhost:8090/api/notifications/register-device" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "expoPushToken": "'$EXPO_TOKEN'",
    "deviceType": "iPhone 13",
    "platform": "iOS"
  }'
```

**Expected Response**:
```json
{
  "message": "Device registered successfully",
  "data": {
    "deviceId": 1,
    "userId": 123,
    "expoPushToken": "ExponentPushToken[...]",
    "isActive": true,
    "dateRegistered": "2024-11-02T10:30:00Z"
  }
}
```

---

## 3️⃣ Send Push Notification via Expo

**Use Expo's API directly to test**

### Send to Order Type
```bash
EXPO_TOKEN="ExponentPushToken[abc123...]"

curl -X POST "https://exp.host/--/api/v2/push/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'$EXPO_TOKEN'",
    "sound": "default",
    "title": "Commande confirmée",
    "body": "Votre commande #12345 a été confirmée",
    "data": {
      "type": "ORDER",
      "orderId": 12345,
      "epicerieId": 1
    }
  }'
```

### Send to Promotion Type
```bash
curl -X POST "https://exp.host/--/api/v2/push/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'$EXPO_TOKEN'",
    "sound": "default",
    "title": "Promotion spéciale",
    "body": "30% de réduction sur les fruits frais",
    "data": {
      "type": "PROMOTION",
      "epicerieId": 2,
      "promoCode": "FRUITS30"
    }
  }'
```

### Send to Delivery Type
```bash
curl -X POST "https://exp.host/--/api/v2/push/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'$EXPO_TOKEN'",
    "sound": "default",
    "title": "Votre livraison arrive",
    "body": "Votre commande sera livrée dans 30 minutes",
    "data": {
      "type": "DELIVERY",
      "orderId": 12345,
      "deliveryStatus": "in-transit"
    }
  }'
```

### Send to Alert Type
```bash
curl -X POST "https://exp.host/--/api/v2/push/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'$EXPO_TOKEN'",
    "sound": "default",
    "title": "Alerte importante",
    "body": "Votre compte a une activité anormale",
    "data": {
      "type": "ALERT",
      "severity": "high"
    }
  }'
```

### Send to Info Type
```bash
curl -X POST "https://exp.host/--/api/v2/push/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'$EXPO_TOKEN'",
    "sound": "default",
    "title": "Information",
    "body": "Une nouvelle épicerie a ouvert près de vous",
    "data": {
      "type": "INFO",
      "epicerieId": 5
    }
  }'
```

---

## 4️⃣ Get All Notifications (Already Implemented)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."

curl -X GET "http://localhost:8090/api/notifications?page=0&size=50" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 5️⃣ Get Unread Notifications (Already Implemented)

```bash
curl -X GET "http://localhost:8090/api/notifications/unread" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 6️⃣ Get Unread Count (Already Implemented)

```bash
curl -X GET "http://localhost:8090/api/notifications/unread/count" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 7️⃣ Mark Notification as Read (Already Implemented)

```bash
curl -X PUT "http://localhost:8090/api/notifications/1/read" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 8️⃣ Mark All as Read (Already Implemented)

```bash
curl -X PUT "http://localhost:8090/api/notifications/mark-all-read" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 9️⃣ Delete Notification (Already Implemented)

```bash
curl -X DELETE "http://localhost:8090/api/notifications/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 🔟 Full Test Sequence

Copy/paste this in order to test the complete flow:

```bash
#!/bin/bash

# 1. Login
echo "1. Getting token..."
RESPONSE=$(curl -s -X POST "http://localhost:8090/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "password": "password123"
  }')

TOKEN=$(echo $RESPONSE | jq -r '.token')
echo "Token: $TOKEN"

# 2. Note: In real app, device sends this token automatically
# Get the EXPO_TOKEN from your device console logs
EXPO_TOKEN="ExponentPushToken[abc123...]"
echo "Using Expo Token: $EXPO_TOKEN"

# 3. Register device (when implemented on backend)
echo "3. Registering device..."
curl -X POST "http://localhost:8090/api/notifications/register-device" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "expoPushToken": "'$EXPO_TOKEN'",
    "deviceType": "iPhone 13",
    "platform": "iOS"
  }'

# 4. Send test notification
echo "4. Sending test notification..."
curl -X POST "https://exp.host/--/api/v2/push/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'$EXPO_TOKEN'",
    "sound": "default",
    "title": "Test Notification",
    "body": "Click to see your notifications",
    "data": {
      "type": "NOTIFICATION"
    }
  }'

# 5. Get all notifications
echo "5. Getting all notifications..."
curl -X GET "http://localhost:8090/api/notifications?page=0&size=50" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# 6. Get unread count
echo "6. Getting unread count..."
curl -X GET "http://localhost:8090/api/notifications/unread/count" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

echo "Done!"
```

---

## 📱 Getting Your Expo Push Token

The token is printed in the console when the app starts:

```
[PushNotificationService] Token reçu: ExponentPushToken[abc123def456...]
```

Or in the browser console (for web):

```javascript
// Search for: "Token reçu:"
// You'll see: ExponentPushToken[...]
```

Save this token to use in cURL commands.

---

## 🧪 Testing Workflow

### Step 1: Get Token
```bash
# From login response
TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

### Step 2: Get Expo Token
```bash
# From app console logs
EXPO_TOKEN="ExponentPushToken[...]"
```

### Step 3: Register Device (when endpoint is ready)
```bash
curl -X POST "http://localhost:8090/api/notifications/register-device" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "expoPushToken": "'$EXPO_TOKEN'",
    "deviceType": "iPhone 13",
    "platform": "iOS"
  }'
```

### Step 4: Send Notification
```bash
# Send via Expo API
curl -X POST "https://exp.host/--/api/v2/push/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'$EXPO_TOKEN'",
    "sound": "default",
    "title": "Test",
    "body": "Test notification",
    "data": {
      "type": "ORDER",
      "orderId": 123
    }
  }'
```

### Step 5: Check Notification Arrived
- Look at phone notification center
- Click notification
- App opens/comes to foreground
- Should navigate to notifications page

### Step 6: Verify Backend Received It
```bash
# Get all notifications
curl -X GET "http://localhost:8090/api/notifications?page=0&size=50" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 🔑 Variables to Replace

In all examples, replace these:

| Variable | Meaning | Example |
|----------|---------|---------|
| `TOKEN` | JWT auth token | `eyJhbGciOiJIUzI1NiIs...` |
| `EXPO_TOKEN` | Push notification token | `ExponentPushToken[abc123...]` |
| `http://localhost:8090` | Backend URL | Change to your server |
| `client@example.com` | User email | Use test account email |
| `password123` | User password | Use test account password |

---

## 📊 Expected Responses

### Register Device - 200 OK
```json
{
  "message": "Device registered successfully",
  "data": {
    "deviceId": 1,
    "userId": 123,
    "expoPushToken": "ExponentPushToken[...]",
    "isActive": true,
    "dateRegistered": "2024-11-02T10:30:00Z"
  }
}
```

### Send Notification - 200 OK
```json
{
  "id": "abc123",
  "status": "sent"
}
```

### Get Notifications - 200 OK
```json
[
  {
    "id": 1,
    "userId": 123,
    "titre": "Test Notification",
    "message": "This is a test",
    "type": "ORDER",
    "isRead": false,
    "dateCreated": "2024-11-02T10:30:00Z"
  }
]
```

### Get Unread Count - 200 OK
```json
{
  "count": 5,
  "userId": 123
}
```

---

## 💡 Tips

1. **Save variables in bash**:
   ```bash
   TOKEN="eyJhbGciOiJIUzI1NiIs..."
   EXPO_TOKEN="ExponentPushToken[...]"
   ```

2. **Reuse in commands**:
   ```bash
   curl ... -H "Authorization: Bearer $TOKEN" ...
   ```

3. **Format JSON response**:
   ```bash
   curl ... | jq .
   ```

4. **Save to file**:
   ```bash
   curl ... > response.json
   cat response.json | jq .
   ```

---

## 🎯 Summary

- **To test**: Use Expo API directly (Step 3-4 above)
- **To integrate**: Implement backend endpoint + register device
- **To send**: Call push service from business logic
- **To verify**: Check notification in app

All cURL commands provided. Just replace variables and run!

---

**Ready to test!** 🚀
