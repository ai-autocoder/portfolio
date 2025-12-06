---
title: "JWT Authentication from Scratch: FastAPI + React Implementation"
date: "2024-11-29"
excerpt: "Build secure JWT authentication with FastAPI backend and React frontend, including password hashing, protected routes, and the security mistakes to avoid."
tags: [jwt, authentication, fastapi, react, security, python]
readTime: 19
---

# JWT Authentication from Scratch: FastAPI + React Implementation

For a recent project, I needed authentication that was secure, simple, and didn't require managing session state across serverless functions. JWT authentication checked all those boxes.

Here's what I learned building a complete auth system from scratch, including the security mistakes I almost made.

## Why JWT?

I'll be honest, I didn't choose JWT because it's trendy. I chose it because:

1. **Stateless**: No session storage needed. Perfect for serverless.
2. **Works across domains**: Frontend on Netlify, API on different domain.
3. **Simple to implement**: Compared to OAuth, anyway.

That said, JWTs aren't perfect. They can't be invalidated (without a database), and if you mess up the security, you're in trouble. More on that later.

## The Backend: FastAPI

### Basic Setup

```python
# main.py
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext

app = FastAPI()

# CORS setup for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourapp.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = "your-secret-key-here"  # In production: use environment variable!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
```

**First mistake I made**: I hardcoded the secret key in the code and almost committed it to GitHub. Use environment variables. Always.

### User Model and Database

I used a simple users table with PostgreSQL:

```python
# models.py
from pydantic import BaseModel, EmailStr
from typing import Optional

class User(BaseModel):
    email: EmailStr
    full_name: str
    hashed_password: str
    is_active: bool = True

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
```

### Password Hashing

Never, ever store plain text passwords. I use bcrypt through passlib:

```python
# auth.py
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```

### Creating JWT Tokens

Here's the function that generates tokens:

```python
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt
```

**Second mistake I made**: I initially set tokens to never expire. Bad idea. 30 minutes for access tokens is reasonable. Some apps use 15 minutes and refresh tokens for longer sessions.

### Registration Endpoint

```python
@app.post("/api/register", response_model=Token)
async def register(user: UserCreate):
    # Check if user already exists
    existing_user = await get_user_by_email(user.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Hash password
    hashed_password = get_password_hash(user.password)

    # Save user to database
    new_user = await create_user({
        "email": user.email,
        "full_name": user.full_name,
        "hashed_password": hashed_password
    })

    # Create access token
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {"access_token": access_token, "token_type": "bearer"}
```

### Login Endpoint

```python
from fastapi.security import OAuth2PasswordRequestForm

@app.post("/api/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Get user from database
    user = await get_user_by_email(form_data.username)  # OAuth2 uses 'username'

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    # Verify password
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    # Create access token
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {"access_token": access_token, "token_type": "bearer"}
```

**Third mistake I made**: My early error messages were too specific ("Email not found" vs "Wrong password"). This helps attackers figure out which emails are registered. Now I just say "Incorrect email or password" for both cases.

### Protected Routes

Now the important part: using the token to protect routes.

```python
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")

        if email is None:
            raise credentials_exception

        token_data = TokenData(email=email)

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired"
        )
    except jwt.JWTError:
        raise credentials_exception

    user = await get_user_by_email(email=token_data.email)

    if user is None:
        raise credentials_exception

    return user

@app.get("/api/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "email": current_user.email,
        "full_name": current_user.full_name
    }
```

Now any route that uses `Depends(get_current_user)` requires a valid JWT token.

## The Frontend: React

### Setting Up Axios

I use axios with an interceptor to automatically add the token to requests:

```javascript
// api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.yourapp.com',
});

// Add token to requests automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Auth Context

I use React Context to manage auth state across the app:

```javascript
// contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    const token = localStorage.getItem('access_token');
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const response = await api.get('/api/profile');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('access_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const formData = new FormData();
    formData.append('username', email);  // OAuth2 expects 'username'
    formData.append('password', password);

    const response = await api.post('/api/login', formData);
    localStorage.setItem('access_token', response.data.access_token);
    await loadUser();
  };

  const register = async (email, password, fullName) => {
    const response = await api.post('/api/register', {
      email,
      password,
      full_name: fullName,
    });
    localStorage.setItem('access_token', response.data.access_token);
    await loadUser();
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

### Login Component

```javascript
// components/Login.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### Protected Routes

```javascript
// components/PrivateRoute.js
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return user ? children : <Navigate to="/login" />;
}

// In your App.js
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
```

## Security Mistakes I Almost Made

### 1. Storing Tokens in Plain LocalStorage

I did this at first, and it's technically vulnerable to XSS attacks. The alternative is httpOnly cookies, but that doesn't work well with serverless functions across domains.

My compromise: LocalStorage + strict Content Security Policy + regular security audits of dependencies.

### 2. Not Validating Token Expiration

Always check the `exp` claim on the backend. Don't trust the client.

### 3. Using Weak Secret Keys

Your SECRET_KEY should be long and random. Use something like:

```python
import secrets
secrets.token_urlsafe(32)
```

### 4. Not Using HTTPS

In production, ALWAYS use HTTPS. JWT tokens sent over HTTP might as well be plain text.

## What I'd Do Differently

### Use Refresh Tokens

My current implementation has a problem: when the access token expires after 30 minutes, users get kicked out. Not great UX.

The proper solution is refresh tokens:
- Short-lived access token (15 min)
- Long-lived refresh token (7 days)
- Endpoint to exchange refresh token for new access token
- Store refresh token in httpOnly cookie

I didn't implement this for the MVP because it adds complexity, but it's on my todo list.

### Add Rate Limiting

Without rate limiting, someone can brute force login attempts. I should add:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/login")
@limiter.limit("5/minute")
async def login(...):
    # login logic
```

### Better Error Logging

I need to log failed login attempts, especially multiple failures from the same IP. Right now I'm flying blind.

## The Results

The auth system works well:
- Users can sign up and log in
- Protected routes stay protected
- Token expiration works
- No major security issues (so far)

Is it perfect? No. But it's secure enough for an MVP, and I can iterate on it.

## Your Turn

If you're building JWT auth, here's my advice:

1. **Start simple**: Get basic login/register working first
2. **Test thoroughly**: Try to break your own auth
3. **Use a library**: Don't roll your own crypto
4. **Plan for refresh tokens**: Even if you don't implement them yet
5. **Monitor failed logins**: You'll want to know if someone's attacking you

And whatever you do, don't commit your SECRET_KEY to GitHub. I've seen it happen more times than I'd like to admit.

---

*Building auth systems? What's your preferred approach? JWT, sessions, or something else? Let me know on LinkedIn.*
