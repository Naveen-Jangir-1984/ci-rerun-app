import { useEffect, useReducer } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getTeams, getUsersByTeam } from "../api";

export default function SignIn() {
  const nav = useNavigate();

  const { login } = useAuth();
  const initialState = {
    teams: [],
    users: [],
    form: { team: "", username: "", password: "" },
    message: "",
  };

  const reducer = (state: any, action: any) => {
    switch (action.type) {
      case "SET_TEAMS":
        return { ...state, teams: action.payload };
      case "SET_USERS":
        return { ...state, users: action.payload };
      case "SET_FORM":
        return { ...state, form: { ...state.form, ...action.payload } };
      case "SET_MESSAGE":
        return { ...state, message: action.payload };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    getTeams().then((teams) => dispatch({ type: "SET_TEAMS", payload: teams }));
  }, []);

  useEffect(() => {
    if (!state.form.team) {
      dispatch({ type: "SET_USERS", payload: [] });
      return;
    }

    getUsersByTeam(state.form.team).then((users) => dispatch({ type: "SET_USERS", payload: users }));
  }, [state.form.team]);

  const submit = async () => {
    const res = await login(state.form.team, state.form.username, state.form.password);
    if (res.status === 401) dispatch({ type: "SET_MESSAGE", payload: res.error });
    else nav("/dashboard");
  };

  const reset = () => {
    dispatch({ type: "SET_FORM", payload: { team: "", username: "", password: "" } });
    dispatch({ type: "SET_USERS", payload: [] });
    dispatch({ type: "SET_MESSAGE", payload: "" });
  };

  const isSubmitDisabled = !state.form.team || !state.form.username || !state.form.password;
  const isResetDisabled = !state.form.team && !state.form.username && !state.form.password;

  return (
    <div className="login">
      <h2>Sign In</h2>
      <select onChange={(e) => dispatch({ type: "SET_FORM", payload: { team: e.target.value } })} value={state.form.team}>
        <option value="">-- Select Team --</option>
        {state.teams.map((t: any) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select value={state.form.username} onChange={(e) => dispatch({ type: "SET_FORM", payload: { username: e.target.value } })} disabled={!state.form.team}>
        <option value="">-- Select User --</option>
        {state.users.map((u: any) => (
          <option key={u.id} value={u.username}>
            {u.username}
          </option>
        ))}
      </select>
      <input type="password" value={state.form.password} disabled={!state.form.username} placeholder="Password" onChange={(e) => dispatch({ type: "SET_FORM", payload: { password: e.target.value } })} />
      <div className="user-actions">
        <button className="button medium-button" disabled={isResetDisabled} onClick={reset}>
          Reset
        </button>
        <button className="button medium-button" disabled={isSubmitDisabled} onClick={submit}>
          Submit
        </button>
      </div>
      <div style={{ fontSize: "0.9rem", color: "red" }}>{state.message}</div>
    </div>
  );
}
