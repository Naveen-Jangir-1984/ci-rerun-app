import { useEffect, useReducer } from "react";
import { getProfile } from "../api";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, update } = useAuth();

  const initialState = {
    firstName: "",
    lastName: "",
    pat: "",
    message: "",
    hasPAT: false,
  };

  const reducer = (state: any, action: any) => {
    switch (action.type) {
      case "SET_FIRST_NAME":
        return { ...state, firstName: action.payload };
      case "SET_LAST_NAME":
        return { ...state, lastName: action.payload };
      case "SET_PAT":
        return { ...state, pat: action.payload };
      case "SET_HAS_PAT":
        return { ...state, hasPAT: action.payload };
      case "SET_MESSAGE":
        return { ...state, message: action.payload };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    getProfile(user.id).then((data) => {
      dispatch({ type: "SET_FIRST_NAME", payload: data.firstName || "" });
      dispatch({ type: "SET_LAST_NAME", payload: data.lastName || "" });
      dispatch({ type: "SET_HAS_PAT", payload: data.hasPAT });
    });
  }, []);

  const cancel = () => {
    window.history.back();
  };

  const save = async () => {
    const res = await update({
      firstName: state.firstName,
      lastName: state.lastName,
      pat: state.pat || undefined, // only update if entered
    });
    if (res.status === 200) {
      dispatch({ type: "SET_MESSAGE", payload: "Updated ! Please wait..." });
      dispatch({ type: "SET_PAT", payload: "" });
      setTimeout(() => cancel(), 1000);
    } else {
      dispatch({ type: "SET_MESSAGE", payload: res.error });
    }
  };

  return (
    <div className="profile">
      <h3>Update Profile</h3>
      <input type="text" value={state.firstName} placeholder="Firstname" onChange={(e) => dispatch({ type: "SET_FIRST_NAME", payload: e.target.value })} />
      <input type="text" value={state.lastName} placeholder="Lastname" onChange={(e) => dispatch({ type: "SET_LAST_NAME", payload: e.target.value })} />
      <input type="password" placeholder={state.hasPAT ? "Enter a new PAT" : "Enter PAT"} value={state.pat} onChange={(e) => dispatch({ type: "SET_PAT", payload: e.target.value })} />
      <div className="user-actions">
        <button className="button medium-button" onClick={cancel}>
          Cancel
        </button>
        <button className="button medium-button" onClick={save}>
          Update
        </button>
      </div>
      <div style={{ color: state.message === "Updated ! Please wait..." ? "green" : "red" }}>{state.message}</div>
    </div>
  );
}
