
from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    # Use mobile viewport
    context = browser.new_context(
        viewport={"width": 375, "height": 812},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
    )
    page = context.new_page()

    # Handle alerts
    page.on("dialog", lambda dialog: print(f"Alert: {dialog.message}") or dialog.accept())

    print("Navigating to http://localhost:8000/ ...")
    page.goto("http://localhost:8000/")

    # Login
    print("Filling login form...")
    page.fill("#email-input", "madness@jules-test.com")
    page.fill("#password-input", "1234567890!")

    print("Clicking login...")
    page.click("#auth-button")

    print("Waiting for Agenda...")
    try:
        page.wait_for_selector("#app-container", state="visible", timeout=15000)
    except Exception as e:
        print("Timeout waiting for Agenda. Taking debug screenshot...")
        page.screenshot(path="/home/jules/verification/debug_login_fail.png")
        # Check if auth container is still visible
        if page.is_visible("#auth-container"):
            print("Auth container is still visible.")
        raise e

    # Wait for classes to load
    try:
        page.wait_for_selector(".card-panel", timeout=10000)
    except:
        print("No card panels found immediately.")

    time.sleep(2)

    print("Taking Agenda screenshot...")
    page.screenshot(path="/home/jules/verification/screenshot_agenda.png")

    # Find a class to click
    # Classes have data-action="navigate-details"
    class_cards = page.locator('[data-action="navigate-details"]')
    count = class_cards.count()
    print(f"Found {count} class cards.")

    if count > 0:
        print("Clicking on first class...")
        class_cards.first.click()

        # Wait for details to load
        print("Waiting for Class Details...")
        try:
            # Check for title or back button or "Reservar" button
            page.wait_for_selector("text=Detalles", timeout=10000)
            time.sleep(1)
            print("Taking Class Details screenshot...")
            page.screenshot(path="/home/jules/verification/screenshot_class_details.png")
        except Exception as e:
             print("Failed to load details.")
             page.screenshot(path="/home/jules/verification/debug_details_fail.png")
    else:
        print("No classes found to click.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
