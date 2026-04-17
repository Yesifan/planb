import { createTitle } from "./actions/create-title";

export default function Home() {
  return (
    <form action={createTitle}>
      <input name="title" />
      <button>Submit</button>
    </form>
  );
}
