import LatestTestComponent from "./components/LatestTest";
import TestAreaComponent from "./components/TestArea";
import "./styles.sass";

const Home = () => (
    <div className="home">
        <LatestTestComponent/>

        <br />

        <TestAreaComponent/>
    </div>
)


export default Home;