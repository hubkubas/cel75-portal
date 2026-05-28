import { login } from './actions'

type SearchParams = Promise<{ error?: string }> | { error?: string }

export default async function LoginPage(props: { searchParams: SearchParams }) {
  // Bezpieczny odczyt parametrów dla Next.js 14 i Next.js 15
  const searchParams = await props.searchParams
  const error = searchParams?.error

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-md">
        
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-orange-500">
            CEL 75
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Zaloguj się do swojego profilu sportowego
          </p>
        </div>

        <form className="mt-8 space-y-6" action={login}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Adres Email
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-zinc-100 placeholder-zinc-500 focus:z-10 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                placeholder="Twój adres email"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Hasło
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-zinc-100 placeholder-zinc-500 focus:z-10 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                placeholder="Hasło"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-950/50 border border-red-800 p-3 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-lg bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 active:scale-[0.98]"
            >
              Zaloguj się
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}