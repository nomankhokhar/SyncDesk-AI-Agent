package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"booking/internal/models"
	"booking/internal/services"
)

// ReservationController maps HTTP requests to the service layer.
type ReservationController struct {
	service *services.ReservationService
}

func NewReservationController(service *services.ReservationService) *ReservationController {
	return &ReservationController{service: service}
}

// GET /api/reservations
func (c *ReservationController) List(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, c.service.List())
}

// GET /api/reservations/:id
func (c *ReservationController) Get(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	r, err := c.service.Get(id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, r)
}

// POST /api/reservations
func (c *ReservationController) Create(ctx *gin.Context) {
	var req models.CreateReservationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	r, err := c.service.Create(req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, r)
}

// POST /api/reservations/:id/cancel
func (c *ReservationController) Cancel(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	r, err := c.service.Cancel(id)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, services.ErrNotFound) {
			status = http.StatusNotFound
		}
		ctx.JSON(status, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, r)
}

// GET /api/analysis
func (c *ReservationController) Analysis(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, c.service.Analysis())
}
