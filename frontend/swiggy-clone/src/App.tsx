import { useEffect, useState } from "react";
import { RestaurantGrid } from "./components/RestaurantGrid/RestaurantGrid";
import { SearchBar } from "./components/SearchBar/SearchBar";
import { BrowseAllNaive } from "./components/BrowseAll/BrowseAllNaive";
import { BrowseAllTransition } from "./components/BrowseAll/BrowseAllTransition";
import { BrowseAllDeferred } from "./components/BrowseAll/BrowseAllDeferred";
import { fetchRestaurants } from "./api/restaurantApi";
import { mapToRestaurant } from "./utils/mapRestaurant";
import { useDebounce } from "./hooks/useDebounce";
import type { Restaurant } from "./types/restaurant";
import './App.css';

const SEARCH_DEBOUNCE_MS = 400;

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
type View = 'search' | 'browse';

function App() {

  const [view, setView] = useState<View>('search');

  const [searchTerm, setSearchTerm] = useState('');
  const debounceSearchTerm = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fires once on mount (debouncedSearchTerm starts as ''), then again
  // every time the DEBOUNCED value changes — not the raw searchTerm.
  // This is the entire point of today: typing "pizza" updates local
  // state on every keystroke, but only fires ONE network request,
  // ~400ms after you stop typing.
  useEffect(() => {
    if (view !== 'search') return;

    let  isCancelled = false;

    async function loadRestaurant() {
      setStatus('loading');
      setErrorMessage(null);

      try{
        const response = await fetchRestaurants({
          search: debounceSearchTerm || undefined,
        })

        // isCancelled only guards against calling setState after this
        // effect's cleanup has already run (e.g. component unmounted
        // mid-request) — it does NOT prevent a slow, stale request from
        // overwriting a newer one. That's a genuinely different bug
        // (a race condition between two in-flight requests), and it's
        // Week 4's manual exercise — left alone on purpose, see
        // restaurantApi.ts.

        if(!isCancelled) {
          setRestaurants(response.restaurants.map(mapToRestaurant));
          setStatus('success');
        }
      } catch(err) {
        if(!isCancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Something went wrong',
          );
          setStatus('error');
        }
      }
    }

    loadRestaurant();

    return () => {
      isCancelled = true;
    };

  }, [debounceSearchTerm, view]);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__logo">SwiggyClone</h1>
        <nav className="app__tabs" aria-label="View switcher">
          <button
            type="button"
            className={view === 'search' ? 'app__tab app__tab--active' : 'app__tab'}
            onClick={() => setView('search')}
          >
            Search
          </button>
          <button
            type="button"
            className={view === 'browse' ? 'app__tab app__tab--active' : 'app__tab'}
            onClick={() => setView('browse')}
          >
            Browse &amp; Filter
          </button>
        </nav>
      </header>

      <main>
        {view === 'search' && (
          <>
            <SearchBar value={searchTerm} onChange={setSearchTerm} />

            {status === 'loading' && (
              <p className="app__status" role="status">
                Loading restaurants...
              </p>
            )}
            {/* role="status" on the loading message and role="alert" on the error — 
            both get announced by screen readers automatically without the user needing to navigate to them, 
            since they're dynamic content appearing after the initial render */}
        
            {status === 'error' && (
              <p className="app__status app__status--error" role="alert">
                {errorMessage}
              </p>
            )}
            {status === 'success' && <RestaurantGrid restaurants={restaurants} />}
          </>
        )}

        {view === 'browse' && <BrowseAllTransition />}

      </main>
    </div>
  )
}

export default App;