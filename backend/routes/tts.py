from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from gtts import gTTS
import io

router = APIRouter(prefix="/api/tts", tags=["TTS"])


@router.get("/")
async def generate_tts(
    text: str = Query(..., description="Text to synthesize"),
    lang: str = Query("en", description="2-letter language code"),
):
    try:
        # Generate the audio bytes in-memory
        tts = gTTS(text=text, lang=lang, slow=False)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)

        return StreamingResponse(fp, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS Generation failed: {str(e)}")
