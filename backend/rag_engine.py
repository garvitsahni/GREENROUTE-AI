import os

# Robust import for dotenv
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Robust import for Gemini
try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False
    print("Warning: google-generativeai not installed.")

# Initialize Gemini
api_key = os.environ.get("GEMINI_API_KEY")

if HAS_GENAI and api_key:
    genai.configure(api_key=api_key)

def get_rag_explanation(route_details, weather, traffic):
    """
    Generates an explanation using Gemini and local context documents.
    """
    if not HAS_GENAI:
        return "AI Module missing (google-generativeai library)."
    if not api_key:
        return "Gemini API Key missing in environment. Using fallback logic."

    try:
        # 1. Load context
        context_text = ""
        base_dir = os.path.dirname(os.path.abspath(__file__))
        docs_path = os.path.join(base_dir, "docs", "sustainability_rules.txt")
             
        if os.path.exists(docs_path):
            with open(docs_path, 'r') as f:
                context_text = f.read()
        else:
            context_text = "Standard sustainability rules apply."
        
        # 2. Construct Prompt
        prompt = f"""
        You are an intelligent logistics assistant for GreenRoute AI.
        Use the following Sustainability Guidelines to explain the routing decision.
        
        GUIDELINES:
        {context_text}
        
        SCENARIO:
        Selected Route: {route_details['name']}
        Distance: {route_details['distance_km']} km
        Emissions: {route_details['emissions']} units
        Weather Risk: {weather} (0-1)
        Traffic Level: {traffic} (1-10)
        
        Explain why this route is optimal given the guidelines. Keep it concise (max 3 sentences).
        """
        
        # 3. Call Gemini
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        
        return response.text
    except Exception as e:
        return f"AI Explanation unavailable: {str(e)}"

def get_customer_message(delay_prob, action):
    """Generates a customer facing message."""
    if not HAS_GENAI or not api_key:
        # Fallback message
        return f"Update: Delay probability {delay_prob*100:.0f}%. Action: {action}."
        
    try:
        prompt = f"""
        Write a short, polite SMS notification (1 sentence) for a logistics customer.
        Context: Delay Probability is {delay_prob*100:.1f}%. Action taken: {action}.
        If delay is high, apologize. If rerouting, mention optimizing for speed.
        """
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        return response.text.strip()
    except:
        return "Your delivery status has been updated."

def get_voice_answer(question):
    """Simple Voice/Chat endpoint."""
    if not HAS_GENAI or not api_key:
        return "Voice system is currently offline (API Key missing)."
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(f"You are GreenRoute Voice Assistant. Answer briefly: {question}")
        return response.text
    except Exception as e:
        return "I could not process that request."

def get_historical_explanation(log_entry):
    """Generates an analysis for a past delivery log."""
    if not HAS_GENAI or not api_key:
        return f"Analysis for Log {log_entry.get('log_id')}: AI features offline."

    try:
        prompt = f"""
        Analyze this historical delivery log as a logistics expert:
        
        Log ID: {log_entry.get('log_id')}
        Route: {log_entry.get('route_id')}
        Vehicle: {log_entry.get('vehicle_id')}
        Status: {log_entry.get('status')}
        Delay: {log_entry.get('delay_minutes')} minutes
        Emissions: {log_entry.get('carbon_emitted_kg')} kg
        Customer Rating: {log_entry.get('customer_rating')}/5

        Provide a concise (2 sentences max) explanation of why this outcome occurred (e.g., relating emissions to vehicle type, or delay to route) and if it met sustainability goals.
        """
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Could not generate historical analysis: {str(e)}"
