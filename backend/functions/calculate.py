# backend/function/calculate.py

def run(operation: str, operand1: float, operand2: float) -> dict:
    try:
        num1 = float(operand1)
        num2 = float(operand2)
    except (ValueError, TypeError):
        raise ValueError("Both operand1 and operand2 should be numbers.")

    if operation == "add":
        result = num1 + num2
    elif operation == "subtract":
        result = num1 - num2
    elif operation == "multiply":
        result = num1 * num2
    elif operation == "divide":
        if num2 == 0:
            raise ValueError("Cannot divide by zero.")
        result = num1 / num2
    else:
        raise ValueError(f"Unsupported operation: {operation}")

    return {"result": result}
