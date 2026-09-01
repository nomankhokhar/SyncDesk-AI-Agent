package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"

	"booking/internal/controllers"
	"booking/internal/routes"
	"booking/internal/services"
	"booking/internal/storage"
)

func main() {
	store := storage.NewStore()
	service := services.NewReservationService(store)
	controller := controllers.NewReservationController(service)

	r := gin.Default()
	routes.Register(r, controller)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Booking API listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
