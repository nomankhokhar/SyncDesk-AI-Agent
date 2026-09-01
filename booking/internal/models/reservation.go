package models

import "time"

// Reservation statuses
const (
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"
)

type Reservation struct {
	ID           int       `json:"id"`
	CustomerName string    `json:"customer_name"`
	Phone        string    `json:"phone"`
	PartySize    int       `json:"party_size"`
	Date         string    `json:"date"` // YYYY-MM-DD
	Time         string    `json:"time"` // HH:MM (24h)
	Notes        string    `json:"notes,omitempty"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
}

// CreateReservationRequest is the POST /reservations payload.
type CreateReservationRequest struct {
	CustomerName string `json:"customer_name" binding:"required"`
	Phone        string `json:"phone" binding:"required"`
	PartySize    int    `json:"party_size" binding:"required,min=1"`
	Date         string `json:"date" binding:"required"`
	Time         string `json:"time" binding:"required"`
	Notes        string `json:"notes"`
}

// Analysis is the GET /analysis response.
type Analysis struct {
	TotalReservations int            `json:"total_reservations"`
	Confirmed         int            `json:"confirmed"`
	Cancelled         int            `json:"cancelled"`
	TotalGuests       int            `json:"total_guests"`
	AvgPartySize      float64        `json:"avg_party_size"`
	ByDate            map[string]int `json:"by_date"`
	BusiestDate       string         `json:"busiest_date,omitempty"`
}
