# MeasurePRO Automated Test Suite

## Overview
Automated test scripts for critical paths in MeasurePRO application. These tests validate core business logic, data transformations, and user workflows.

**IMPORTANT NOTES:**
- ✅ **Tests now import and verify REAL MeasurePRO code** from `src/lib/` utilities
- ⚠️ **`npm test` is not configured** - Use `npx vitest` commands instead (see Running Tests below)
- 🎯 **Focus on utility functions** - Tests target pure business logic that can be imported independently
- 🚫 **Limited integration tests** - Full component testing requires React, Firebase, and hardware APIs which are difficult to mock

## What Gets Tested

These tests import and verify **actual MeasurePRO production code**:
- ✅ GPS utilities: `calculateDistance()`, `decimalToDMS()`, `formatCoordinate()`, `calculateBearing()`
- ✅ Unit conversions: `metersToFeetInches()`, `feetInchesToMeters()`, `formatMeasurement()`, `parseInputToMeters()`
- ✅ License features: `isFreeTierFeature()`, `getUnlicensedMessage()`, `LICENSED_FEATURES`, `FEATURE_INFO`
- ✅ Validation patterns: Email regex, password strength, activation code format
- ✅ Data transformation: CSV escaping, JSON formatting, GeoJSON structure, coordinate conversion
- ✅ **NEW! Component workflows**: License activation form, export button interactions, user input handling

## Component Testing Approach (NEW!)

**Component tests render actual React components and simulate user interactions end-to-end.**

### What Component Tests Demonstrate

✅ **License Activation Component** (`licenseActivation.test.ts`):
- Renders actual `LicenseActivation` React component
- Simulates user typing activation code (with auto-formatting)
- Clicks "Activate License" button
- Verifies `activateLicenseCode()` function called with correct parameters
- Tests success/error message display
- Verifies toast notifications shown
- Tests loading states during async operations

✅ **Data Export Component** (`dataExport.test.ts`):
- Creates test component with export button functionality
- Simulates clicking Export CSV/JSON/GeoJSON buttons
- Verifies `exportToCSV()`, `exportToJSON()`, `exportToGeoJSON()` called
- Mocks DOM download APIs (Blob, URL.createObjectURL, createElement)
- Verifies correct MIME types and file download initiated
- Tests empty data handling

### Component Testing Tools

These tests use:
- **React Testing Library** - Render components, query DOM elements
- **@testing-library/user-event** - Simulate realistic user interactions (typing, clicking)
- **Vitest Mocking** - Mock API functions, DOM APIs, browser features
- **happy-dom** - Lightweight DOM environment for headless testing

### Test Setup

`src/tests/setup.ts` provides:
- React Testing Library auto-cleanup after each test
- Mocked toast notifications (Sonner)
- Mocked DOM download APIs (URL.createObjectURL, document.createElement)
- Mocked Firebase Auth (with current user)
- Mocked browser APIs (IndexedDB, Web Serial, Geolocation, MediaDevices)

### Example Component Test

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LicenseActivation from '@/components/licensing/LicenseActivation';

it('should activate license when user enters code and clicks button', async () => {
  const user = userEvent.setup();
  const mockActivate = vi.mocked(licensing.activateLicenseCode);
  mockActivate.mockResolvedValue({ success: true, license: {...} });

  render(<LicenseActivation />);
  
  const input = screen.getByTestId('input-activation-code');
  const button = screen.getByTestId('button-activate');
  
  await user.type(input, 'MPROTESTCODE1234');
  await user.click(button);
  
  await waitFor(() => {
    expect(mockActivate).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MPRO-TEST-CODE-1234' })
    );
  });
  
  expect(screen.getByText(/License activated successfully/i)).toBeInTheDocument();
});
```

### Component Testing Strategy

**What We Test:**
1. Component renders without crashing
2. UI elements present (inputs, buttons, text)
3. User interactions work (typing, clicking)
4. API functions called with correct parameters
5. Success/error states displayed correctly
6. Loading states shown during async operations
7. Callbacks and side effects triggered

**What We Mock:**
1. API functions (licensing, export, database)
2. Firebase Auth and Cloud Functions
3. Browser APIs (Blob, URL, DOM manipulation)
4. External libraries (toast notifications)

**What We Don't Test:**
1. Actual Firebase backend logic (requires emulator)
2. Real file downloads (requires browser)
3. Complex multi-step forms (requires extensive setup)
4. Hardware APIs (camera, GPS, serial ports)

### Limitations & Future Work

⚠️ **Complex Components Not Tested**:
- `RegisterPage` - Multi-step form with Firebase Auth, email verification
- `POICapture` - Requires camera, GPS, IndexedDB integration
- `MeasurementLogs` - Requires Zustand stores for survey, GPS, camera state

⚠️ **Partial Integration**:
- Firebase Cloud Functions are mocked, not tested with real backend
- File downloads verified by DOM API calls, not actual file creation
- State management (Zustand stores) not fully integrated in tests

💡 **Future Improvements**:
1. Add Firebase emulator for true backend integration
2. Create simplified versions of complex components for testing
3. Add E2E tests with Playwright for full user flows
4. Mock Zustand stores to test components that depend on global state
5. Add visual regression testing for UI consistency

### Why This Approach Works

✅ **Pragmatic**: Tests what's achievable without massive refactoring
✅ **Demonstrates Capability**: Shows component testing is feasible
✅ **Real Code**: Tests actual production components and functions
✅ **Extensible**: Provides foundation for future test expansion
✅ **Documented**: Clear limitations and next steps

## Test Files

### 1. User Registration (`userRegistration.test.ts`)
Tests the user registration workflow including:
- Form validation patterns (email format, password strength, required fields)
- Firebase account creation API calls
- Email verification process
- **FREE TIER FEATURE CHECKING** using real `isFreeTierFeature()` function
- **UNLICENSED MESSAGE GENERATION** using real `getUnlicensedMessage()` function
- User approval workflow logic

**Real MeasurePRO Code Tested:**
- `@/lib/licensing/features.ts` - `isFreeTierFeature()`, `getUnlicensedMessage()`

**Limitations:** Form validation is in React components using Zod schemas - tests verify patterns, not imported code.

### 2. License Activation (`licenseActivation.test.ts`)
Tests premium license activation including:
- Activation code validation (format, expiry, usage limits)
- License record structure and creation
- **FEATURE CONSTANTS** - real `LICENSED_FEATURES`, `FEATURE_INFO`, `FEATURE_CATEGORIES`
- **FEATURE CHECKING LOGIC** - real `isFreeTierFeature()` function
- **ERROR MESSAGING** - real `getUnlicensedMessage()` function
- Device fingerprinting and limits

**Real MeasurePRO Code Tested:**
- `@/lib/licensing/features.ts` - All licensing constants and utility functions

**Limitations:** Activation code validation and license creation happen in Firebase Cloud Functions.

### 3. POI Capture (`poiCapture.test.ts`)
Tests Point of Interest data capture including:
- **GPS DISTANCE CALCULATION** using real Haversine formula `calculateDistance()`
- **COORDINATE CONVERSION** using real `decimalToDMS()` function
- **COORDINATE FORMATTING** using real `formatCoordinate()` function  
- **BEARING CALCULATION** using real `calculateBearing()` function
- **UNIT CONVERSION** using real `metersToFeetInches()`, `feetInchesToMeters()` functions
- **MEASUREMENT FORMATTING** using real `formatMeasurement()`, `parseInputToMeters()` functions
- Photo metadata structure validation
- POI data assembly patterns

**Real MeasurePRO Code Tested:**
- `@/lib/utils/geoUtils.ts` - All GPS calculation functions
- `@/lib/utils/unitConversion.ts` - All unit conversion and formatting functions

**Limitations:** GPS acquisition, camera capture, and IndexedDB operations are browser APIs in React components.

### 4. Data Export (`dataExport.test.ts`)
Tests survey data export functionality including:
- **MEASUREMENT FORMATTING FOR EXPORT** using real `formatMeasurement()` function
- **DUAL-UNIT FORMATTING** using real `formatMeasurementDual()` function
- **COORDINATE FORMATTING FOR GEOJSON/KML** using real `formatCoordinate()` function
- **DISTANCE CALCULATION FOR METADATA** using real `calculateDistance()` function
- CSV escaping patterns and structure
- JSON structure validation
- GeoJSON coordinate order (longitude, latitude)
- KML XML generation patterns

**Real MeasurePRO Code Tested:**
- `@/lib/utils/unitConversion.ts` - Measurement formatting for exports
- `@/lib/utils/geoUtils.ts` - GPS formatting for exports

**Limitations:** Export functions (`exportToCSV()`, `exportToJSON()`, `exportToGeoJSON()`) use DOM APIs which are hard to unit test.

## Running Tests

### Prerequisites
```bash
# Install dependencies (if not already installed)
npm install
```

### Run All Tests
```bash
# ⚠️ NOTE: 'npm test' is NOT configured in package.json
# Use npx vitest commands instead:

# Run all tests once
npx vitest

# Alternative: Run once without watch mode
npx vitest run

# Run tests in watch mode (re-run on file changes)
npx vitest watch

# Run tests with coverage report
npx vitest --coverage
```

### Run Specific Test Files
```bash
# User registration tests only
npx vitest src/tests/userRegistration.test.ts

# License activation tests only
npx vitest src/tests/licenseActivation.test.ts

# POI capture tests only
npx vitest src/tests/poiCapture.test.ts

# Data export tests only
npx vitest src/tests/dataExport.test.ts
```

### Run Specific Test Suites
```bash
# Run tests matching a pattern
npx vitest -t "GPS"

# Run tests in a specific describe block
npx vitest -t "License Activation"
```

## Test Configuration

Tests are configured in `vitest.config.ts`:
- **Environment**: happy-dom (lightweight DOM emulator)
- **Globals**: Enabled (describe, it, expect available globally)
- **Setup**: `src/tests/setup.ts` (mocks for browser APIs)
- **Coverage**: v8 provider with text/json/html reporters

## Mocked APIs

The test setup (`src/tests/setup.ts`) provides mocks for:
- **IndexedDB**: Local database storage
- **Web Serial API**: Laser meter communication
- **Geolocation API**: GPS positioning
- **MediaDevices API**: Camera access
- **Web Audio API**: Alert sounds
- **localStorage**: Browser storage
- **Firebase Auth**: User authentication
- **Firebase Firestore**: Cloud database

## Manual Testing

Each test file includes a comprehensive manual testing checklist at the bottom. These checklists cover:
- **Happy Path**: Normal user workflows
- **Error Cases**: Invalid inputs, network failures, edge cases
- **UI Validation**: Visual feedback, toast messages, state updates
- **Integration**: Firebase, hardware devices, external services

### Example Manual Test Execution

For User Registration:
1. Open browser to `/register`
2. Follow checklist in `userRegistration.test.ts`
3. Verify each checkbox item
4. Document any failures or unexpected behavior

## Writing New Tests

### Test Structure
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  describe('Sub-Feature', () => {
    it('should behave correctly', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = someFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Best Practices
1. **Descriptive Names**: Test names should clearly state what is being tested
2. **Arrange-Act-Assert**: Structure tests in three clear sections
3. **One Assertion**: Each test should verify one specific behavior
4. **Independent**: Tests should not depend on execution order
5. **Fast**: Keep tests quick (< 100ms each if possible)
6. **Deterministic**: Same input should always produce same output

### Mock Usage
```typescript
import { vi } from 'vitest';

// Mock a function
const mockFn = vi.fn().mockReturnValue('result');

// Mock a module
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
}));

// Verify mock was called
expect(mockFn).toHaveBeenCalledWith('expected', 'args');
```

## Test Coverage Goals

- **Unit Tests**: > 80% coverage for business logic
- **Integration Tests**: All critical paths covered
- **Manual Tests**: All user workflows validated

### Current Coverage

Run `npx vitest --coverage` to see detailed coverage report in:
- Terminal output
- `coverage/index.html` (open in browser for visual report)

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npx vitest run  # Use 'npx vitest run' not 'npm test'

- name: Generate Coverage
  run: npx vitest --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests Failing with Firebase Errors
- Ensure Firebase mocks are properly configured in `setup.ts`
- Check that real Firebase isn't being imported in test environment

### Tests Failing with "Cannot find module"
- **FIXED:** Path alias `@/` now points to `./src` (was incorrectly pointing to `./client/src`)
- Verify imports use correct alias: `@/` for src, `@shared/` for shared, `@assets/` for attached_assets
- Check that imported files exist in `src/lib/` directories

### Tests Timing Out
- Increase timeout in test file: `it('test', () => {...}, 10000)`
- Check for unhandled promises or async operations

### Coverage Not Generating
- Install coverage provider: `npm install -D @vitest/coverage-v8`
- Check vitest.config.ts has coverage configuration

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Docs](https://testing-library.com/)
- [MeasurePRO Testing Guide](../../TESTING_GUIDE.md)
- [Firebase Testing Guide](https://firebase.google.com/docs/rules/unit-tests)

## Contributing

When adding new features to MeasurePRO:

1. Write automated tests first (TDD approach)
2. Ensure tests pass locally
3. Run full test suite before committing
4. Update manual testing checklists
5. Document any new test patterns or mocks

## Contact

For questions about testing:
- Email: jfprince@soltec.ca
- See main [TESTING_GUIDE.md](../../TESTING_GUIDE.md) for comprehensive testing procedures
