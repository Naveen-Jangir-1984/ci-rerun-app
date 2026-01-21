import { useReducer } from "react";
import { useAuth } from "../context/AuthContext";

export default function Password() {
  const { update } = useAuth();

  const initialState = {
    password: { current: "", password: "", confirm: "" },
    message: "",
  };

  const reducer = (state: any, action: any) => {
    switch (action.type) {
      case "SET_PASSWORD":
        return { ...state, password: { ...state.password, ...action.payload } };
      case "SET_MESSAGE":
        return { ...state, message: action.payload };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  function cancel() {
    window.history.back();
  }

  async function save() {
    if (state.password.password !== state.password.confirm) {
      dispatch({ type: "SET_MESSAGE", payload: "New and Confirm Passwords do not match" });
      return;
    }
    const res = await update({
      current: state.password.current,
      password: state.password.password,
    });
    if (res.status === 200) {
      dispatch({ type: "SET_MESSAGE", payload: "Updated ! Please wait..." });
      dispatch({ type: "SET_PASSWORD", payload: { current: "", password: "", confirm: "" } });
      setTimeout(() => cancel(), 1000);
    } else {
      dispatch({ type: "SET_MESSAGE", payload: res.error });
    }
  }

  const isUpdateDisabled = !state.password.current || !state.password.password || !state.password.confirm;

  return (
    <div className="password">
      <h3>Update Password</h3>
      <input type="password" placeholder="Current" onChange={(e) => dispatch({ type: "SET_PASSWORD", payload: { current: e.target.value } })} />
      <input type="password" placeholder="New" onChange={(e) => dispatch({ type: "SET_PASSWORD", payload: { password: e.target.value } })} />
      <input type="password" placeholder="Confirm" onChange={(e) => dispatch({ type: "SET_PASSWORD", payload: { confirm: e.target.value } })} />
      <div className="user-actions">
        <button className="button medium-button" onClick={cancel}>
          Cancel
        </button>
        <button className="button medium-button" disabled={isUpdateDisabled} onClick={save}>
          Update
        </button>
      </div>
      <div style={{ color: state.message === "Updated ! Please wait..." ? "green" : "red" }}>{state.message}</div>
    </div>
  );
}
