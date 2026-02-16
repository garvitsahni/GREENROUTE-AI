import os

# Robust imports
try:
    import pandas as pd
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    HAS_ML = True
except ImportError as e:
    print(f"Warning: ML libraries missing ({e}). Using dummy mode.")
    HAS_ML = False
    # Dummy classes for type safety if needed, though we handle flags
    RandomForestClassifier = None

# Global model store
model = None

def train_model():
    """Trains the Random Forest model on startup."""
    global model
    
    if not HAS_ML:
        return

    # Use absolute path relative to this file
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, "data", "training_delays.csv")
        
    try:
        if not os.path.exists(path):
            raise FileNotFoundError(f"Training data not found at {path}")

        df = pd.read_csv(path)
        X = df[['distance_km', 'traffic_factor', 'weather_risk']]
        y = df['is_delayed']
        
        if RandomForestClassifier:
            # Simple training
            rf = RandomForestClassifier(n_estimators=50, random_state=42)
            rf.fit(X, y)
            model = rf
            print("ML Model trained successfully.")
    except Exception as e:
        print(f"Error training ML model: {e}")
        # Create dummy model for safety
        if RandomForestClassifier:
            try:
                model = RandomForestClassifier()
                model.fit([[10, 1, 0.1], [100, 10, 0.9]], [0, 1])
            except:
                model = None

def predict_delay_probability(distance, traffic, weather):
    """Returns probability of delay (0.0 to 1.0)."""
    global model
    
    if not HAS_ML:
        return 0.5

    if model is None:
        return 0.5
    
    # Input must match feature shape
    X_new = [[distance, traffic, weather]]
    try:
        # predict_proba returns [[prob_class_0, prob_class_1]]
        prob_delayed = model.predict_proba(X_new)[0][1]
        return float(prob_delayed)
    except:
        return 0.5