package routes

import (
	"github.com/gin-gonic/gin"

	"booking/internal/controllers"
)

// Register wires all API routes.
func Register(r *gin.Engine, rc *controllers.ReservationController) {
	api := r.Group("/api")
	{
		api.GET("/reservations", rc.List)
		api.GET("/reservations/:id", rc.Get)
		api.POST("/reservations", rc.Create)
		api.POST("/reservations/:id/cancel", rc.Cancel)
		api.GET("/analysis", rc.Analysis)
	}
}
