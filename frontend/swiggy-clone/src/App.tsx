import { mockRestaurants } from "./data/mockRestaurants";
import { RestaurantGrid } from "./components/RestaurantGrid/RestaurantGrid";
import './App.css';


function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__logo">SwiggyClone</h1>
      </header>

      <main>
        <RestaurantGrid restaurants={mockRestaurants} />
      </main>
    </div>
  )
}

export default App;