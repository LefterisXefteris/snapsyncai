import httpx

@app.get("/items")
async def get_items():
    