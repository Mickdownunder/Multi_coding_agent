import Counter from '@/components/Counter';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background text-foreground">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Control System</h1>
          <p className="text-muted-foreground">Welcome to your autonomous agent dashboard.</p>
        </div>
        
        <div className="w-full flex justify-center">
          <Counter />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-center">
          <div className="p-4 border rounded-lg">
            <h3 className="font-bold">State</h3>
            <p className="text-xs opacity-70">Managed via state.txt</p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-bold">Execution</h3>
            <p className="text-xs opacity-70">Autonomous Agent Flow</p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-bold">Verification</h3>
            <p className="text-xs opacity-70">Rule-based validation</p>
          </div>
        </div>
      </div>
    </main>
  );
}