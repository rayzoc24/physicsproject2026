import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// ErrorBoundary catches any render-time crash and shows the actual error
// message instead of a blank page, making debugging possible.
class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { error: null };
	}
	static getDerivedStateFromError(error) {
		return { error };
	}
	render() {
		if (this.state.error) {
			return (
				<div style={{ padding: "2rem", color: "#ff7b7b", fontFamily: "monospace" }}>
					<strong>App crashed:</strong>
					<pre style={{ marginTop: "1rem", whiteSpace: "pre-wrap", color: "#e9f5ff" }}>
						{this.state.error.message}
						{"\n"}
						{this.state.error.stack}
					</pre>
				</div>
			);
		}
		return this.props.children;
	}
}

// StrictMode is intentionally removed: it double-invokes effects in development
// which corrupts the Three.js imperative scene setup (canvas gets removed and
// re-appended in a broken state, causing a blank renderer).
ReactDOM.createRoot(document.getElementById("root")).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>
);
