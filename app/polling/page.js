// app/livepooling/page.js
import LivePooling from "@/components/livepooling/LivePooling";

export default function LivePoolingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        <LivePooling />
      </main>
    </div>
  );
}
