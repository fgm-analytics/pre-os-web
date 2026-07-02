export type ToolResult = Record<string, any> & { error?: string };

export type ToolHandler = (
  args: any,
  vendedorCode?: number | null
) => Promise<ToolResult>;
