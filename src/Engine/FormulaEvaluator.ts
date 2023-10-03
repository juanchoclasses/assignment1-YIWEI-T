import Cell from "./Cell"
import SheetMemory from "./SheetMemory"
import { ErrorMessages } from "./GlobalDefinitions";



export class FormulaEvaluator {
  // Define a function called update that takes a string parameter and returns a number
  private _errorOccured: boolean = false;
  private _errorMessage: string = "";
  private _currentFormula: FormulaType = [];
  private _lastResult: number = 0;
  private _sheetMemory: SheetMemory;
  private _result: number = 0;


  constructor(memory: SheetMemory) {
    this._sheetMemory = memory;
  }

  /**
   * Evaluates a given formula, replacing cell references with their respective values
   * and calculating the result, while also handling various error scenarios.
   * 
   */

  evaluate(formula1: FormulaType) {
    this._errorMessage = "";
    this._result = Infinity;
    // replace cell value
    let arr = [];
    const columns = ['A', 'B', 'C', 'D', 'E', 'H', 'I', 'J', 'K'];
    for (let i = 0; i < formula1.length; i++) {
      let value = formula1[i];
      let word0 = value[0];
      if (columns.includes(word0)) {
        try {
          let cell = this._sheetMemory.getCellByLabel(value);
          if (!cell) {
            this._errorMessage = ErrorMessages.invalidCell;
            return;
          }
          if (cell.getFormula().length === 0) {
            this._errorMessage = ErrorMessages.invalidCell;
            return;
          }
          if (cell.getError()) {
            this._errorMessage = cell.getError();
            return;
          }
          arr.push(cell.getValue().toString());
        }catch (error) {
          this._errorMessage = ErrorMessages.invalidCell;
          return;
        } 
      } else if (i>0 && formula1[i-1] != "*" && value === "(") {// In case of implicit multiplication, prefix (*) to (*).
        arr.push("*");
        arr.push(value)
      } else {
        arr.push(value);
      }
    }
    let formula = arr;
    
    if (formula.length === 0) {
      this._errorMessage = ErrorMessages.emptyFormula;
      return;
    }
    let a = this.calculateFun(formula)
    if (a[0] != null && a[1] != null) {
      this._result = a[0];
      this._errorMessage = a[1];
      return;
    } else {
      this._errorMessage = ErrorMessages.invalidFormula;
      return;
    }
  }
  /**
   * Converts a Infix Notation to a Postfix Notation and computes the result
   * @param expression Infix Notation
   * @returns null or number or DIV/0 exception
   */
  
  calculateFun(expression: string[]): [number|null,string] {
    /*
      Operator Priority Definitions
    */
    const calculationalSymbols = {
      "+": 1,
      "-": 1,
      "*": 2,
      "/": 2
    } as Record<string, number>;
    /*
      Definition of a function that computes two numbers
    */
    const tokensMap: { [key: string]: (postfix: number[]) => number } = {
      '+': (postfix) => postfix.pop()! + postfix.pop()!,
      '-': (postfix) => 0 - postfix.pop()! + postfix.pop()!,
      '*': (postfix) => postfix.pop()! * postfix.pop()!,
      '/': (postfix) => {
        const divisor = postfix.pop()!;
        const dividend = postfix.pop()!;
        return dividend / divisor;
      },
    };
    const operatorStack: string[] = [];// The auxiliary stack is used for temporary storage of operators and parentheses
    const postfix: number[] = [];// Storing Postfix Notation
    let number = "";//Storing numbers, including integers and decimals
    for (const token of expression){
      if (!/[0-9.]/.test(token)) {// Prevents numbers from being multiple characters, combining them together first
        if (number.length > 0) {// If the length of number is greater than 0, it means that there is a spliced number that hasn't been pushed into the Postfix Notation.
          let floatNumber = parseFloat(number);
          if (floatNumber.toString() != number) { //Exceeds the precision of number Returns null directly, if it is .1, it will also return null to indicate that the expression is wrong.
            return [null,ErrorMessages.invalidNumber];
          }
          postfix.push(floatNumber);
          number = "";
        }
        if ("+-*/".includes(token)) {// if it is operational character
          /*
            If the current auxiliary stack is not empty, and the priority of the current operator is not greater than that of the top-stack operator, 
            and it is not a parenthesis, because there will be no ")" in the auxiliary stack, because immediately after push ")" in the auxiliary stack, 
            the operator in "(***)" will be taken out of the stack and added to the suffix expression. out of the stack and added to the postfix expression.
           
            Push the top-stack operator of the auxiliary stack into the Postfix Notation and compute it.
          */
          while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== "(" && calculationalSymbols[token] <= calculationalSymbols[operatorStack[operatorStack.length - 1]]) {
            if(postfix.length < 2){// Preventing stack overflow exceptions
              return [postfix[0],ErrorMessages.invalidFormula];
            }
            postfix.push(tokensMap[operatorStack.pop()!](postfix));
          }
          operatorStack.push(token);// If the above situation does not exist, it is added directly to the auxiliary stack.
        } else if (token === "(") { // If the left bracket
          operatorStack.push(token);
        } else if (token === ")") {
          /*
           pops the operator on the stack and counts the last two digits in the Postfix Notation until it encounters the left parenthesis
          */
          while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== "(") {
            if(postfix.length < 2){// Preventing stack overflow exceptions
              return [postfix[0],ErrorMessages.invalidFormula];
            }
            postfix.push(tokensMap[operatorStack.pop()!](postfix));
          }
          operatorStack.pop();// Pop-up left brackets
        }
      } else {
        number += token;
      }
    }
    if (number.length > 0) {
      let floatNumber = parseFloat(number);
      if (floatNumber.toString() != number) { //Exceeds the precision of a number and returns null.
        return [null,ErrorMessages.invalidNumber];
      }
      postfix.push(floatNumber);
    }
    // Pop the remaining operators in the stack and compute the Postfix Notation
    while (operatorStack.length > 0) {
      if(postfix.length < 2){// Preventing stack overflow exceptions
        return [postfix[0],ErrorMessages.invalidFormula];
      }
      postfix.push(tokensMap[operatorStack.pop()!](postfix));
    }
    if (postfix.length === 0){
      return [0,ErrorMessages.missingParentheses];
    }
    if (postfix.length === 1) {
      if (!isFinite(postfix[0])){
        return [Infinity,ErrorMessages.divideByZero];
      }
      return [postfix[0],""];// Returns the result of the calculation
    } else {
      return [null,ErrorMessages.invalidFormula];;// Mismatch between the number of operands and the number of operators; return null to indicate that the computation failed
    }
  }

  public get error(): string {
    return this._errorMessage
  }

  public get result(): number {
    return this._result;
  }




  /**
   * 
   * @param token 
   * @returns true if the toke can be parsed to a number
   */
  isNumber(token: TokenType): boolean {
    return !isNaN(Number(token));
  }

  /**
   * 
   * @param token
   * @returns true if the token is a cell reference
   * 
   */
  isCellReference(token: TokenType): boolean {

    return Cell.isValidCellLabel(token);
  }

  /**
   * 
   * @param token
   * @returns [value, ""] if the cell formula is not empty and has no error
   * @returns [0, error] if the cell has an error
   * @returns [0, ErrorMessages.invalidCell] if the cell formula is empty
   * 
   */
  getCellValue(token: TokenType): [number, string] {

    let cell = this._sheetMemory.getCellByLabel(token);
    let formula = cell.getFormula();
    let error = cell.getError();

    // if the cell has an error return 0
    if (error !== "" && error !== ErrorMessages.emptyFormula) {
      return [0, error];
    }

    // if the cell formula is empty return 0
    if (formula.length === 0) {
      return [0, ErrorMessages.invalidCell];
    }


    let value = cell.getValue();
    return [value, ""];

  }


}

export default FormulaEvaluator;