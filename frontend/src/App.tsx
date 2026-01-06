
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import { AppRoutes } from './routes';
import { Layout } from './components/layout/Layout';

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Layout>
          <AppRoutes />
        </Layout>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </Router>
    </Provider>
  );
}

export default App;