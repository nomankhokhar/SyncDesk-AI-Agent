package services

import (
	"errors"
	"sort"
	"strings"
	"time"

	"booking/internal/models"
	"booking/internal/storage"
)

var (
	ErrNotFound         = errors.New("reservation not found")
	ErrAlreadyCancelled = errors.New("reservation already cancelled")
	ErrBadDate          = errors.New("date must be YYYY-MM-DD")
	ErrBadTime          = errors.New("time must be HH:MM (24h)")
)

// ReservationService holds the booking business logic.
type ReservationService struct {
	store *storage.Store
}

func NewReservationService(store *storage.Store) *ReservationService {
	return &ReservationService{store: store}
}

func (s *ReservationService) List() []models.Reservation {
	items := s.store.List()
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *ReservationService) Get(id int) (models.Reservation, error) {
	r, ok := s.store.Get(id)
	if !ok {
		return models.Reservation{}, ErrNotFound
	}
	return r, nil
}

func (s *ReservationService) Create(req models.CreateReservationRequest) (models.Reservation, error) {
	if _, err := time.Parse("2006-01-02", req.Date); err != nil {
		return models.Reservation{}, ErrBadDate
	}
	if _, err := time.Parse("15:04", req.Time); err != nil {
		return models.Reservation{}, ErrBadTime
	}
	// Idempotency: a repeated create for the same guest/date/time — e.g. the
	// voice agent re-issuing the tool call after a mid-call interruption —
	// returns the existing booking instead of creating a duplicate.
	for _, r := range s.store.List() {
		if r.Status == models.StatusConfirmed &&
			strings.EqualFold(strings.TrimSpace(r.CustomerName), strings.TrimSpace(req.CustomerName)) &&
			r.Date == req.Date && r.Time == req.Time {
			return r, nil
		}
	}
	return s.store.Create(models.Reservation{
		CustomerName: req.CustomerName,
		Phone:        req.Phone,
		PartySize:    req.PartySize,
		Date:         req.Date,
		Time:         req.Time,
		Notes:        req.Notes,
		Status:       models.StatusConfirmed,
	}), nil
}

func (s *ReservationService) Cancel(id int) (models.Reservation, error) {
	r, ok := s.store.Get(id)
	if !ok {
		return models.Reservation{}, ErrNotFound
	}
	if r.Status == models.StatusCancelled {
		return models.Reservation{}, ErrAlreadyCancelled
	}
	r.Status = models.StatusCancelled
	s.store.Update(r)
	return r, nil
}

// Analysis aggregates simple booking stats.
func (s *ReservationService) Analysis() models.Analysis {
	a := models.Analysis{ByDate: map[string]int{}}
	for _, r := range s.store.List() {
		a.TotalReservations++
		if r.Status == models.StatusCancelled {
			a.Cancelled++
			continue
		}
		a.Confirmed++
		a.TotalGuests += r.PartySize
		a.ByDate[r.Date]++
		if a.ByDate[r.Date] > a.ByDate[a.BusiestDate] {
			a.BusiestDate = r.Date
		}
	}
	if a.Confirmed > 0 {
		a.AvgPartySize = float64(a.TotalGuests) / float64(a.Confirmed)
	}
	return a
}
