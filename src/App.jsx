import SmokingMan from "./demo/SmokingMan.jsx";
import SmokingCigarette from "./demo/SmokingCigarette.jsx";
import PauseApp from "./app/PauseApp.jsx";

function App() {
  if (window.location.pathname === "/demo/smoking_man") {
    return <SmokingMan />;
  }
  if (window.location.pathname === "/demo/smoking") {
    return <SmokingCigarette />;
  }

  return <PauseApp />;
}

export default App;
