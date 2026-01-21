import { useEffect, useReducer } from "react";
import { useAuth } from "../context/AuthContext";
import { getTeams } from "../api";

export default function Register() {
  const { register } = useAuth();

  const initalState = {
    teams: [],
    form: { team: "", username: "", firstName: "", lastName: "", password: "", confirm: "" },
    message: { color: "", text: "" },
  };

  const reducer = (state: any, action: any) => {
    switch (action.type) {
      case "SET_TEAMS":
        return { ...state, teams: action.payload };
      case "SET_FORM":
        return { ...state, form: { ...state.form, ...action.payload } };
      case "SET_MESSAGE":
        return { ...state, message: action.payload };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, initalState);

  useEffect(() => {
    getTeams().then((teams) => dispatch({ type: "SET_TEAMS", payload: teams }));
  }, []);

  function reset() {
    dispatch({
      type: "SET_FORM",
      payload: {
        team: "",
        username: "",
        firstName: "",
        lastName: "",
        password: "",
        confirm: "",
      },
    });
    dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
  }

  async function submit() {
    if (state.form.password !== state.form.confirm) {
      dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "Password and Confirm Passwords do not match" } });
      return;
    }
    const res = await register({
      team: state.form.team,
      username: state.form.username,
      firstName: state.form.firstName,
      lastName: state.form.lastName,
      password: state.form.password,
    });
    if (res.status === 409) {
      dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: res.error } });
    } else {
      dispatch({ type: "SET_MESSAGE", payload: { color: "green", text: "Registered successfully" } });
      dispatch({
        type: "SET_FORM",
        payload: {
          team: "",
          username: "",
          firstName: "",
          lastName: "",
          password: "",
          confirm: "",
        },
      });
    }
  }

  const isResetDisabled = !state.form.team && !state.form.username && !state.form.firstName && !state.form.lastName && !state.form.password && !state.form.confirm;
  const isSubmitDisabled = !state.form.team || !state.form.username || !state.form.firstName || !state.form.lastName || !state.form.password || !state.form.confirm;

  return (
    <div className="register">
      <h2>Sign Up</h2>
      <select value={state.form.team} onChange={(e) => dispatch({ type: "SET_FORM", payload: { team: e.target.value } })}>
        <option>Select Team</option>
        {state.teams.map((t: any) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input type="text" placeholder="Username" value={state.form.username} onChange={(e) => dispatch({ type: "SET_FORM", payload: { username: e.target.value } })} />
      <input type="text" placeholder="First Name" value={state.form.firstName} onChange={(e) => dispatch({ type: "SET_FORM", payload: { firstName: e.target.value } })} />
      <input type="text" placeholder="Last Name" value={state.form.lastName} onChange={(e) => dispatch({ type: "SET_FORM", payload: { lastName: e.target.value } })} />
      <input type="password" placeholder="Password" value={state.form.password} onChange={(e) => dispatch({ type: "SET_FORM", payload: { password: e.target.value } })} />
      <input type="password" placeholder="Confirm" value={state.form.confirm} onChange={(e) => dispatch({ type: "SET_FORM", payload: { confirm: e.target.value } })} />
      <div className="user-actions">
        <button className="button medium-button" disabled={isResetDisabled} onClick={reset}>
          Reset
        </button>
        <button className="button medium-button" disabled={isSubmitDisabled} onClick={submit}>
          Submit
        </button>
      </div>
      <div style={{ fontSize: "0.9rem", color: state.message.color }}>{state.message.text}</div>
    </div>
  );
}
