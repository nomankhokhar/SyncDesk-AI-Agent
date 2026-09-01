package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// MCP server (stdio) exposing the Booking API as tools for AI agents.
// Set BOOKING_API_URL if the API is not on localhost:8080.

var apiURL = func() string {
	if u := os.Getenv("BOOKING_API_URL"); u != "" {
		return u
	}
	return "http://localhost:8080"
}()

// callAPI performs an HTTP request against the booking API and returns the body.
func callAPI(method, path string, payload any) (string, error) {
	var body io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return "", err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, apiURL+"/api"+path, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("booking API unreachable at %s: %w", apiURL, err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("API error (%d): %s", resp.StatusCode, b)
	}
	return string(b), nil
}

// asResult converts an API response/error into an MCP tool result.
func asResult(body string, err error) (*mcp.CallToolResult, error) {
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(body), nil
}

func main() {
	s := server.NewMCPServer("booking-mcp", "1.0.0")

	s.AddTool(
		mcp.NewTool("get_booking_analysis",
			mcp.WithDescription("Get booking statistics: totals, cancellations, guests, average party size and busiest date."),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return asResult(callAPI(http.MethodGet, "/analysis", nil))
		},
	)

	s.AddTool(
		mcp.NewTool("list_reservations",
			mcp.WithDescription("List all reservations with their status."),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return asResult(callAPI(http.MethodGet, "/reservations", nil))
		},
	)

	s.AddTool(
		mcp.NewTool("create_reservation",
			mcp.WithDescription("Book a new reservation for a customer."),
			mcp.WithString("customer_name", mcp.Required(), mcp.Description("Customer full name")),
			mcp.WithString("phone", mcp.Required(), mcp.Description("Customer phone number in E.164 format")),
			mcp.WithNumber("party_size", mcp.Required(), mcp.Description("Number of guests")),
			mcp.WithString("date", mcp.Required(), mcp.Description("Reservation date, YYYY-MM-DD")),
			mcp.WithString("time", mcp.Required(), mcp.Description("Reservation time, HH:MM 24h")),
			mcp.WithString("notes", mcp.Description("Optional special requests")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			payload := map[string]any{
				"customer_name": req.GetString("customer_name", ""),
				"phone":         req.GetString("phone", ""),
				"party_size":    req.GetInt("party_size", 0),
				"date":          req.GetString("date", ""),
				"time":          req.GetString("time", ""),
				"notes":         req.GetString("notes", ""),
			}
			return asResult(callAPI(http.MethodPost, "/reservations", payload))
		},
	)

	s.AddTool(
		mcp.NewTool("cancel_reservation",
			mcp.WithDescription("Cancel an existing reservation by its ID."),
			mcp.WithNumber("id", mcp.Required(), mcp.Description("Reservation ID")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			id := req.GetInt("id", 0)
			return asResult(callAPI(http.MethodPost, fmt.Sprintf("/reservations/%d/cancel", id), nil))
		},
	)

	if err := server.ServeStdio(s); err != nil {
		log.Fatal(err)
	}
}
