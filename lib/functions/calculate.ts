// lib/functions/calculate.ts

export function runCalculate(operation: string, operand1: number, operand2: number): { result: number } {
    const num1 = operand1;
    const num2 = operand2;
  
    switch (operation) {
      case "add":
        return { result: num1 + num2 };
      case "subtract":
        return { result: num1 - num2 };
      case "multiply":
        return { result: num1 * num2 };
      case "divide":
        if (num2 === 0) {
          throw new Error("Cannot divide by zero.");
        }
        return { result: num1 / num2 };
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }
  