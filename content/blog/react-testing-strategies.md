---
title: "Testing Strategies for React Applications: What to Test and Why"
date: "2025-01-31"
excerpt: "Practical testing strategies for React apps that catch real bugs without wasting time: unit tests, integration tests, and E2E tests with real-world examples."
tags: [testing, react, jest, testing-library, quality-assurance]
readTime: 8
---

# Testing Strategies for React Applications: What to Test and Why

I used to write tests for everything. 100% code coverage was my goal. Sounds great, right?

Then I spent two weeks maintaining tests that tested nothing important. Tests that broke every time I changed button text. Tests that passed even when the app was completely broken.

Here's what I've learned about testing React apps in a way that actually catches bugs without wasting your time.

## The Testing Pyramid (And Why It Matters)

```
       /\
      /  \    E2E Tests (few)
     /----\
    /      \  Integration Tests (some)
   /--------\
  /          \ Unit Tests (many)
 /____________\
```

Most of your tests should be fast, isolated unit tests.
Some should be integration tests.
A few should be end-to-end tests.

I used to do the opposite: mostly E2E tests. Bad idea. They're slow, flaky, and hard to debug.

## What to Test (And What NOT to Test)

### ❌ Don't Test Implementation Details

```javascript
// ❌ BAD - Testing internal state
test('clicking button sets isOpen to true', () => {
  const { container } = render(<Dropdown />);
  const button = screen.getByRole('button');

  fireEvent.click(button);

  expect(container.querySelector('.dropdown').state.isOpen).toBe(true);
});
```

This test breaks if you rename `isOpen` to `isExpanded`. But the component still works fine.

```javascript
// ✅ GOOD - Testing user-visible behavior
test('clicking button shows dropdown menu', () => {
  render(<Dropdown />);
  const button = screen.getByRole('button');

  fireEvent.click(button);

  expect(screen.getByRole('menu')).toBeInTheDocument();
});
```

This test only breaks if the actual functionality breaks.

### ✅ DO Test User Interactions

```javascript
test('user can submit a form with valid data', async () => {
  const handleSubmit = jest.fn();
  render(<ContactForm onSubmit={handleSubmit} />);

  // Fill out form
  await userEvent.type(screen.getByLabelText(/name/i), 'John Doe');
  await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com');
  await userEvent.type(screen.getByLabelText(/message/i), 'Hello!');

  // Submit
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));

  // Verify submission
  expect(handleSubmit).toHaveBeenCalledWith({
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Hello!'
  });
});
```

This tests what users actually do: fill out a form and submit it.

### ✅ DO Test Edge Cases

```javascript
test('shows error when email is invalid', async () => {
  render(<ContactForm onSubmit={jest.fn()} />);

  await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));

  expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
});

test('disables submit button while submitting', async () => {
  const slowSubmit = () => new Promise(resolve => setTimeout(resolve, 1000));
  render(<ContactForm onSubmit={slowSubmit} />);

  await userEvent.type(screen.getByLabelText(/name/i), 'John');
  await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com');

  const button = screen.getByRole('button', { name: /submit/i });
  await userEvent.click(button);

  expect(button).toBeDisabled();
});
```

### ❌ Don't Test Third-Party Libraries

```javascript
// ❌ BAD - Testing that react-router works
test('Link component navigates to correct path', () => {
  render(<Link to="/about">About</Link>);
  const link = screen.getByRole('link');

  expect(link).toHaveAttribute('href', '/about');
});
```

React Router is already tested. Trust it.

### ❌ Don't Test Trivial Code

```javascript
// ❌ BAD - Testing a simple function
function add(a, b) {
  return a + b;
}

test('adds two numbers', () => {
  expect(add(2, 3)).toBe(5);
});
```

This is obvious. No need to test it unless there's actual logic.

## The Tools I Use

### React Testing Library (Not Enzyme)

I used to use Enzyme. It encouraged testing implementation details. React Testing Library is better.

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import MyComponent from './MyComponent';

test('basic test', async () => {
  render(<MyComponent />);

  const button = screen.getByRole('button');
  await userEvent.click(button);

  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

## Unit Testing Components

### Simple Component

```javascript
// Button.jsx
export function Button({ label, onClick, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// Button.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button label="Click me" onClick={jest.fn()} />);

    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('calls onClick when clicked', async () => {
    const handleClick = jest.fn();
    render(<Button label="Click me" onClick={handleClick} />);

    await userEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button label="Click me" onClick={jest.fn()} disabled />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Component with State

```javascript
// Counter.jsx
import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}

// Counter.test.jsx
describe('Counter', () => {
  it('starts at zero', () => {
    render(<Counter />);

    expect(screen.getByText(/count: 0/i)).toBeInTheDocument();
  });

  it('increments when increment button is clicked', async () => {
    render(<Counter />);

    await userEvent.click(screen.getByRole('button', { name: /increment/i }));

    expect(screen.getByText(/count: 1/i)).toBeInTheDocument();
  });

  it('resets to zero when reset button is clicked', async () => {
    render(<Counter />);

    await userEvent.click(screen.getByRole('button', { name: /increment/i }));
    await userEvent.click(screen.getByRole('button', { name: /increment/i }));
    await userEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(screen.getByText(/count: 0/i)).toBeInTheDocument();
  });
});
```

## Testing API Calls

### Mocking fetch

```javascript
// UserProfile.jsx
import { useState, useEffect } from 'react';

export function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>Hello, {user.name}!</div>;
}

// UserProfile.test.jsx
global.fetch = jest.fn();

describe('UserProfile', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it('shows loading state initially', () => {
    fetch.mockResolvedValue({
      json: async () => ({ name: 'John' })
    });

    render(<UserProfile userId={123} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows user data after loading', async () => {
    fetch.mockResolvedValue({
      json: async () => ({ name: 'John Doe' })
    });

    render(<UserProfile userId={123} />);

    expect(await screen.findByText(/hello, john doe/i)).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    fetch.mockRejectedValue(new Error('Network error'));

    render(<UserProfile userId={123} />);

    expect(await screen.findByText(/error: network error/i)).toBeInTheDocument();
  });
});
```

### Using MSW (Mock Service Worker)

Better approach for complex API mocking:

```javascript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/users/:userId', (req, res, ctx) => {
    return res(ctx.json({ name: 'John Doe', email: 'john@example.com' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('fetches and displays user', async () => {
  render(<UserProfile userId={123} />);

  expect(await screen.findByText(/john doe/i)).toBeInTheDocument();
});

test('handles error response', async () => {
  server.use(
    rest.get('/api/users/:userId', (req, res, ctx) => {
      return res(ctx.status(500), ctx.json({ error: 'Server error' }));
    })
  );

  render(<UserProfile userId={123} />);

  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

## Testing Context and Hooks

```javascript
// AuthContext.jsx
import { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (userData) => setUser(userData);
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Component using context
export function UserGreeting() {
  const { user, logout } = useAuth();

  if (!user) return <div>Please log in</div>;

  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

// UserGreeting.test.jsx
function renderWithAuth(ui, { user = null } = {}) {
  function Wrapper({ children }) {
    return <AuthProvider>{children}</AuthProvider>;
  }

  return render(ui, { wrapper: Wrapper });
}

test('shows login prompt when not authenticated', () => {
  renderWithAuth(<UserGreeting />);

  expect(screen.getByText(/please log in/i)).toBeInTheDocument();
});

test('shows greeting when authenticated', () => {
  renderWithAuth(<UserGreeting />, {
    user: { name: 'John' }
  });

  // Need to manually set up user in context
  // Better approach: use custom render with initial state
});
```

## Integration Tests

Test multiple components working together:

```javascript
// LoginFlow.test.jsx
test('complete login flow', async () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );

  // Initially not logged in
  expect(screen.getByText(/please log in/i)).toBeInTheDocument();

  // Fill login form
  await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'password123');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));

  // Should see dashboard after login
  expect(await screen.findByText(/welcome, john/i)).toBeInTheDocument();

  // Logout
  await userEvent.click(screen.getByRole('button', { name: /logout/i }));

  // Should see login prompt again
  expect(screen.getByText(/please log in/i)).toBeInTheDocument();
});
```

## E2E Tests with Playwright

For critical user flows:

```javascript
// e2e/login.spec.js
import { test, expect } from '@playwright/test';

test('user can log in and access dashboard', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Fill login form
  await page.fill('input[name="email"]', 'john@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Wait for navigation and verify dashboard
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.locator('h1')).toContainText('Dashboard');
});

test('shows error with invalid credentials', async ({ page }) => {
  await page.goto('http://localhost:3000');

  await page.fill('input[name="email"]', 'wrong@example.com');
  await page.fill('input[name="password"]', 'wrongpassword');
  await page.click('button[type="submit"]');

  await expect(page.locator('.error-message')).toContainText('Invalid credentials');
});
```

## Test Coverage (The Right Way)

Don't aim for 100% coverage. Aim for confidence.

```bash
npm test -- --coverage
```

Good coverage targets:
- **Critical paths**: 100% (login, checkout, payment)
- **Business logic**: 90%+
- **UI components**: 70-80%
- **Utilities**: 90%+
- **Overall**: 70-80% is good enough

I'd rather have 70% coverage of important code than 100% coverage of everything including trivial stuff.

## My Testing Workflow

1. **Write test first** (sometimes, when I know what I'm building)
2. **Make it pass** (write minimal code)
3. **Refactor** (tests stay green)
4. **Integration test** (test components together)
5. **E2E test** (for critical flows only)

## Common Mistakes (That I Made)

### Mistake #1: Testing Implementation, Not Behavior

I used to test internal state, props, and CSS classes. All broke when I refactored.

**Fix**: Test what users see and do.

### Mistake #2: Brittle Selectors

```javascript
// ❌ BAD
const button = container.querySelector('.btn-primary.btn-lg.submit-btn');

// ✅ GOOD
const button = screen.getByRole('button', { name: /submit/i });
```

### Mistake #3: Not Cleaning Up

```javascript
// ❌ BAD
test('does something', () => {
  // Test code
  // Leaves stuff in DOM
});

// ✅ GOOD
import { cleanup } from '@testing-library/react';

afterEach(cleanup);  // Or just use @testing-library/react which does this automatically
```

### Mistake #4: Testing Too Much in One Test

```javascript
// ❌ BAD - one test doing everything
test('entire application works', async () => {
  // 200 lines of test code
});

// ✅ GOOD - small, focused tests
test('login form validation works', () => { /* ... */ });
test('login with valid credentials succeeds', async () => { /* ... */ });
test('login with invalid credentials fails', async () => { /* ... */ });
```

## The Bottom Line

Good tests:
- ✅ Test user behavior, not implementation
- ✅ Are easy to understand
- ✅ Fail when functionality breaks
- ✅ Pass when functionality works
- ✅ Are fast to run

Bad tests:
- ❌ Test internal state
- ❌ Break when you refactor
- ❌ Are slow and flaky
- ❌ Give false confidence

Write tests that help you ship with confidence, not tests that check boxes.

---

*What's your testing philosophy? Team "test everything" or team "test what matters"? Share your take on LinkedIn.*
