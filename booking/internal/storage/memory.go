package storage

import (
	"sync"
	"time"

	"booking/internal/models"
)

// Store is a thread-safe in-memory reservation store.
// Swap this for a real database behind the same methods.
type Store struct {
	mu    sync.RWMutex
	seq   int
	items map[int]models.Reservation
}

func NewStore() *Store {
	s := &Store{items: make(map[int]models.Reservation)}
	// Seed data so the API has something to show
	s.Create(models.Reservation{CustomerName: "Ayesha Khan", Phone: "+923001112233", PartySize: 2, Date: time.Now().Format("2006-01-02"), Time: "19:00", Status: models.StatusConfirmed})
	s.Create(models.Reservation{CustomerName: "John Smith", Phone: "+15551234567", PartySize: 4, Date: time.Now().AddDate(0, 0, 1).Format("2006-01-02"), Time: "20:30", Status: models.StatusConfirmed})
	return s
}

func (s *Store) List() []models.Reservation {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Reservation, 0, len(s.items))
	for _, r := range s.items {
		out = append(out, r)
	}
	return out
}

func (s *Store) Get(id int) (models.Reservation, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.items[id]
	return r, ok
}

func (s *Store) Create(r models.Reservation) models.Reservation {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seq++
	r.ID = s.seq
	r.CreatedAt = time.Now()
	s.items[r.ID] = r
	return r
}

func (s *Store) Update(r models.Reservation) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[r.ID] = r
}

// Delete removes a reservation. Returns false if it did not exist.
func (s *Store) Delete(id int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[id]; !ok {
		return false
	}
	delete(s.items, id)
	return true
}
