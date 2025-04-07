declare module 'xpath' {
  // Define the type for the function returned by useNamespaces
  type XPathSelect = {
    (expression: string, node: Node, single?: boolean): Node | Node[] | null;
  };

  // Define the useNamespaces function
  export function useNamespaces(namespaces: { [prefix: string]: string }): XPathSelect;

  // Define the select function directly (if used without useNamespaces)
  export function select(expression: string, node: Node, single?: boolean): Node | Node[] | null;

  // Add other exports from the 'xpath' library if you use them
  // e.g., export function evaluate(...): any;
}
