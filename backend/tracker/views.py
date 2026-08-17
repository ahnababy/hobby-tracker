from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Habit, HabitLog
from .serializers import HabitSerializer, HabitLogSerializer

class HabitViewSet(viewsets.ModelViewSet):
    queryset = Habit.objects.all()
    serializer_class = HabitSerializer

    @action(detail=False, methods=['post'], url_path='toggle-log')
    def toggle_log(self, request):
        habit_id = request.data.get('habit_id')
        log_date = request.data.get('date')
        
        if not habit_id or not log_date:
            return Response(
                {'error': 'Both habit_id and date are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            habit = Habit.objects.get(id=habit_id)
        except Habit.DoesNotExist:
            return Response({'error': 'Habit not found.'}, status=status.HTTP_404_NOT_FOUND)

        log, created = HabitLog.objects.get_or_create(
            habit_fk=habit,
            date=log_date,
            defaults={'is_done': True}
        )

        if not created:
            if 'is_done' in request.data:
                log.is_done = request.data['is_done']
            else:
                log.is_done = not log.is_done
            log.save()

        return Response(HabitLogSerializer(log).data, status=status.HTTP_200_OK)
