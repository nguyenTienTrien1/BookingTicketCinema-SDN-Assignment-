import Navbar from './home/Navbar';

export default function Header({ tab, setTab, user, onSearch }) {
  return <Navbar tab={tab} setTab={setTab} user={user} onSearch={onSearch} />;
}
