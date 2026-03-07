import React from "react";

interface Props {
  data: unknown;
  maxHeight?: string;
}

export function JsonViewer({ data, maxHeight = "300px" }: Props) {
  return (
    <pre
      className="code-block"
      style={{ maxHeight }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
