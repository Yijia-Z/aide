# tool_functions/calculate.py

def execute(**kwargs):
    num1 = kwargs.get('num1')
    num2 = kwargs.get('num2')
    operation = kwargs.get('operation')

    try:
        num1 = float(num1)
        num2 = float(num2)
    except (ValueError, TypeError):
        raise ValueError("Both num1 and num2 should be numbers.")

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
