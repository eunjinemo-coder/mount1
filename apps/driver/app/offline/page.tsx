'use client';

export default function OfflinePage(): React.ReactElement {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          {'\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC\uC785\uB2C8\uB2E4'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {
            '\uB124\uD2B8\uC6CC\uD06C \uC5F0\uACB0\uC744 \uD655\uC778\uD558\uACE0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694'
          }
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {
            '\uC5F0\uACB0\uC774 \uBCF5\uAD6C\uB418\uBA74 \uC544\uB798 \uBC84\uD2BC\uC73C\uB85C \uC0C8\uB85C\uACE0\uCE68\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
          }
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {'\uC0C8\uB85C\uACE0\uCE68'}
        </button>
      </div>
    </main>
  );
}
