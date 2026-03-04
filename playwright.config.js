// @ts-check
import { defineConfig, devices } from '@playwright/test';


// const timestamp = new Date()
//   .toISOString()
//   .replace(/[:.]/g, '-')
//   .split('T')
//   .join('_');   // e.g. "2026-01-27_06-40-12-500Z"

// Create a filesystem-safe timestamp (YYYY-MM-DDTHH-mm-ss)
//const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '');
const pad = n => n.toString().padStart(2, '0');
const d = new Date();
const displayTs = `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const fsTs = displayTs.replace(/:/g, '-');
// Set before reporter initialization so allure-playwright picks it up
process.env.ALLURE_RESULTS_DIR = `allure-results/${fsTs}`;
console.log('📁 Allure results folder:', process.env.ALLURE_RESULTS_DIR);

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // @ts-ignore
 
reporter: [
    ['line'],
    ['allure-playwright', { resultsDir: `allure-results/${fsTs}` }]  
  ],
 // globalSetup : './allure-timestamp.js',
  timeout: 100_000, // default cap for each test is now 60s
  expect: { timeout: 7_000 }, // optional: assertions timeout

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    headless: false,
    ignoreHTTPSErrors: true,
    screenshot: 'on',
    actionTimeout: 10_000,       // optional default for actions
    naigationTimeout: 30_000,   // optional default for navigations
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',
      
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on',
  },

 


  /* Configure projects for major browsers */
  projects: [
    {
      name: 'SIT-TEST',
      grep: /@p0|@smoke/,
      retries: 2,
      workers: 2,
      use: { ...devices['Desktop Chrome'],
        channel : 'chrome',
        outputDir: 'test-artifacts/chrome',
        viewport: {
          width: 1920,
          height: 1200,
        },
        baseURL: 'https://practicetestautomation.com/practice-test-login/',
      },
    },

    {
      name: 'SIT-TEST-EDGE',
      grep: /@p0|@smoke/,
      retries: 2,
      workers: 2,
      use: { ...devices['Desktop Edge'],
        channel : 'msedge',
        outputDir: 'test-artifacts/edge',
        viewport: {
          width: 1920,
          height: 1200,
        },
        baseURL: 'https://practicetestautomation.com/practice-test-login/',
      },
    },

    {
      name: 'SIT-TRIP',
      grepInvert: /@p0|@smoke/,
       retries: 2,
      workers: 2,
      use: { ...devices['Desktop Chrome'],
        channel : 'chrome',
        outputDir: 'test-artifacts/chrome',
        viewport: {
          width: 1920,
          height: 1200,
        },
      // launchOptions: {
      // args: ['--start-maximized'],   // Maximizes the browser window
      // },
      baseURL: 'https://www.makemytrip.com/',
      },
    },
    
     {
      name: 'API-TEST',
      grepInvert: /@p0|@smoke/,
      retries: 2,
      workers: 2,
      use: { ...devices['Desktop Chrome'],
        channel : 'chrome',
        outputDir: 'test-artifacts/chrome',
        viewport: {
          width: 1920,
          height: 1200,
        },
        baseURL: 'https://dummyjson.com',
      },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

