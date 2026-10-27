"use client";

import { useState } from "react";
import DeleteWinDialog from "../../../components/DeleteWinDialog";

export default function Page() {
  const [message, setMessage] = useState("Nothing deleted yet.");

  return (
    <main className="space-y-4 p-6">
      <h1 className="text-xl font-bold">Sandbox: delete-confirm dialog</h1>
      <p>Finished my first 5k!</p>
      <DeleteWinDialog
        winText="Finished my first 5k!"
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 800));
          setMessage("Deleted! (fake, nothing was sent to the API)");
        }}
      />
      <p role="status">{message}</p>
    </main>
  );
}