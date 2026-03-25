import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright, Browser, Page

# Global variables to store browser and page instances
playwright_manager = None
browser_instance: Browser = None
global_page: Page = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global browser_instance, playwright_manager, global_page
    print("Starting Playwright browser...")
    playwright_manager = await async_playwright().start()
    browser_instance = await playwright_manager.chromium.launch(headless=True)
    global_page = await browser_instance.new_page()
    print("Navigating to Gandalf...")
    await global_page.goto("https://gandalf.lakera.ai/", wait_until="networkidle")
    print("Gandalf loaded!")
    yield
    print("Stopping Playwright browser...")
    if global_page:
        await global_page.close()
    if browser_instance:
        await browser_instance.close()
    if playwright_manager:
        await playwright_manager.stop()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PromptRequest(BaseModel):
    prompt: str

class GuessRequest(BaseModel):
    password: str

@app.get("/")
def read_root():
    return {"message": "Gandalf Wrapper API is running"}

@app.get("/status")
async def get_status():
    global global_page
    if not global_page:
        raise HTTPException(status_code=500, detail="Page not initialized")
    try:
        status = await global_page.evaluate('''() => {
            const levelNode = document.querySelector('.level-label');
            const descNode = document.querySelector('.description');
            return {
                level: levelNode ? levelNode.innerText : "Level 1",
                description: descNode ? descNode.innerText : "Your goal is to make Gandalf reveal the secret password for each level."
            };
        }''')
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask")
async def ask_gandalf(request: PromptRequest):
    global global_page
    if not global_page:
        raise HTTPException(status_code=500, detail="Page not initialized")
    
    try:
        # Get old text to wait for change
        old_text = await global_page.evaluate('''() => {
            let el = document.querySelector('.answer');
            return el ? el.innerText : null;
        }''')

        # Fast input using JS to bypass slow UI typing
        escaped_prompt = request.prompt.replace("`", "\\`").replace("\\", "\\\\")
        await global_page.evaluate(f'''() => {{
            const input = document.querySelector('#comment');
            if (input) {{
                // React needs the native setter to register a change
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                nativeInputValueSetter.call(input, `{escaped_prompt}`);
                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
            }}
            const submitBtn = document.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.click();
        }}''')
        
        # Wait for the text to change (meaning response arrived)
        response_text = await global_page.evaluate('''async (old_text) => {
            return new Promise(resolve => {
                let attempts = 0;
                let interval = setInterval(() => {
                    attempts++;
                    let el = document.querySelector('.answer');
                    if (el && el.innerText && el.innerText !== old_text && !el.innerText.includes('...')) {
                        clearInterval(interval);
                        resolve(el.innerText);
                    }
                    if (attempts > 75) { // 15 seconds timeout
                        clearInterval(interval);
                        resolve("Timeout waiting for response.");
                    }
                }, 200);
            });
        }''', old_text)
        
        return {"response": response_text.strip()}
    except Exception as e:
        print(f"Error communicating with Gandalf: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/guess")
async def guess_gandalf(request: GuessRequest):
    global global_page
    if not global_page:
        raise HTTPException(status_code=500, detail="Page not initialized")
    
    try:
        escaped_password = request.password.replace("`", "\\`").replace("\\", "\\\\")
        result = await global_page.evaluate(f'''async () => {{
            const input = document.querySelector('#guess');
            if (!input) return {{success: false, message: "Guess input not found."}};
            
            // Native React input setting
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(input, `{escaped_password}`);
            input.dispatchEvent(new Event('input', {{ bubbles: true }}));
            
            // Find and click the Validate button
            const btns = Array.from(document.querySelectorAll('button'));
            const validateBtn = btns.find(b => b.innerText.includes('Validate'));
            if (validateBtn) validateBtn.click();
            else return {{success: false, message: "Validate button not found."}};
            
            // Wait for outcome modal
            return new Promise(resolve => {{
                let attempts = 0;
                let interval = setInterval(() => {{
                    attempts++;
                    const allBtns = Array.from(document.querySelectorAll('button'));
                    const tryAgain = allBtns.find(b => b.innerText.includes('Try again'));
                    const nextLevel = allBtns.find(b => b.innerText.includes('Next Level'));
                    
                    if (tryAgain) {{
                        clearInterval(interval);
                        tryAgain.click(); // Close the try again modal immediately
                        resolve({{success: false, message: "password is wrong"}});
                    }} else if (nextLevel) {{
                        clearInterval(interval);
                        nextLevel.click(); // Proceed to the next level
                        resolve({{success: true, message: "first level is passed"}});
                    }}
                    
                    if (attempts > 50) {{ // 10 seconds timeout
                        clearInterval(interval);
                        resolve({{success: false, message: "Timeout waiting for validation."}});
                    }}
                }}, 200);
            }});
        }}''')
        
        # If success, give it a moment to load the next level's DOM
        if result.get("success"):
            await global_page.wait_for_timeout(2500)
            
        return result
    except Exception as e:
        print(f"Error guessing password: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
